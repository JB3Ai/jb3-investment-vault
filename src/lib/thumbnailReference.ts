/** Generic provenance binding; populated IDs and hashes stay in private records. */
export interface ThumbnailReference { parentId:string; parentSha256:string; imageSha256:string }
export function thumbnailReference(value:unknown):ThumbnailReference|null {
 if(typeof value!=='string'||!value.startsWith('thumbnail-of:'))return null
 const match=/^thumbnail-of:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12});parent-sha256:([0-9a-f]{64});sha256:([0-9a-f]{64})$/i.exec(value)
 if(!match)throw Error('Invalid thumbnail parent provenance')
 return {parentId:match[1].toLowerCase(),parentSha256:match[2].toLowerCase(),imageSha256:match[3].toLowerCase()}
}
