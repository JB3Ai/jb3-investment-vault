import '../styles/final-refinements.css'
export function BuildReference(){return <span className="build-reference" aria-label="Application build">BUILD · {typeof __VAULT_BUILD_REFERENCE__==='string'?__VAULT_BUILD_REFERENCE__:'LOCAL'}</span>}
