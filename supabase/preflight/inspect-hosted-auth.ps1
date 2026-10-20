# Windows credential-store bridge for the Node-only operator process.
# No secrets are returned: only allowlisted Auth metadata from one fixed project.
$ErrorActionPreference = 'Stop'
$stage = 'credential-reader-initialization'
try {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class VaultCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Credential {
    public UInt32 Flags; public UInt32 Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob;
    public UInt32 Persist; public UInt32 AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool Read(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr credential);
}
'@
  $token = $null
  $stage = 'default-cli-credential-read'
  foreach ($target in @('Supabase CLI:supabase')) {
    $pointer = [IntPtr]::Zero
    if ([VaultCredentialReader]::Read($target, 1, 0, [ref]$pointer)) {
      try {
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][VaultCredentialReader+Credential])
        $bytes = New-Object byte[] $credential.CredentialBlobSize
        [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)
        foreach ($encoding in @([Text.Encoding]::UTF8, [Text.Encoding]::Unicode)) {
          $candidate = $encoding.GetString($bytes).TrimEnd([char]0)
          if ($candidate.StartsWith('go-keyring-base64:')) {
            $candidate = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($candidate.Substring(18)))
          }
          if ($candidate -match '^sbp_[A-Za-z0-9_-]+$') { $token = $candidate; break }
        }
        [Array]::Clear($bytes, 0, $bytes.Length)
      } finally { [VaultCredentialReader]::CredFree($pointer) }
    }
    if ($token) { break }
  }
  if (-not $token) { throw 'No supported default Supabase CLI credential found.' }
  $stage = 'management-auth-config-get'
  $config = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/uxeolplwhtyyefpmwktw/config/auth' -Method Get -Headers @{Authorization=('Bearer ' + $token)} -MaximumRedirection 0 -TimeoutSec 30
  $token = $null
  $fields = @('external_email_enabled','external_anonymous_users_enabled','disable_signup','password_min_length','password_required_characters','password_hibp_enabled','jwt_exp','refresh_token_rotation_enabled','security_refresh_token_reuse_interval','sessions_timebox','sessions_inactivity_timeout','sessions_single_per_user','security_update_password_require_reauthentication','rate_limit_otp','rate_limit_token_refresh')
  $safe = [ordered]@{}
  foreach ($field in $fields) {
    if ($config.PSObject.Properties.Name -contains $field) { $safe[$field] = $config.$field }
  }
  $hooks = [ordered]@{}
  foreach ($property in $config.PSObject.Properties) {
    if ($property.Name -match '^hook_[a-z_]+_enabled$') { $hooks[$property.Name] = $property.Value }
  }
  $canonical = [ordered]@{}
  foreach ($property in ($config.PSObject.Properties | Sort-Object Name)) { $canonical[$property.Name] = $property.Value }
  $configBytes = [Text.Encoding]::UTF8.GetBytes(($canonical | ConvertTo-Json -Depth 30 -Compress))
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $fingerprint = ([BitConverter]::ToString($hasher.ComputeHash($configBytes))).Replace('-','').ToLowerInvariant() } finally { $hasher.Dispose() }
  [ordered]@{ passed=$true; project_ref='uxeolplwhtyyefpmwktw'; settings=$safe; hooks=$hooks; auth_config_sha256=$fingerprint } | ConvertTo-Json -Depth 5 -Compress
} catch {
  $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { $null }
  [ordered]@{ passed=$false; failure='Windows login / read-only Management Auth inspection unavailable'; stage=$stage; http_status=$status } | ConvertTo-Json -Compress
  exit 1
}
