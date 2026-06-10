# issue-ref-links

## Purpose

Las referencias a issues en mensajes de tag y CHANGELOG se emiten como links markdown completos al issue tracker (issue #57).

## Requirements

### Requirement: Same-repo issue references as full markdown links
Cuando hay `baseUrl` del repositorio disponible, `formatCommitList()` SHALL transformar cada referencia `#<num>` del mensaje de commit en un link markdown `[#<num>](<baseUrl>/issues/<num>)`.

#### Scenario: Referencia simple en tag annotation
- **WHEN** un commit con mensaje `fix: resuelve error de escaneo (#62)` se incluye en un release con `baseUrl` `https://github.com/owner/repo`
- **THEN** el mensaje del tag y la entrada de CHANGELOG contienen `[#62](https://github.com/owner/repo/issues/62)`

### Requirement: Cross-repo issue references as full markdown links
Las referencias `owner/repo#<num>` SHALL transformarse en `[owner/repo#<num>](https://github.com/owner/repo/issues/<num>)`, sin que la parte `#<num>` sea procesada doblemente por la regla same-repo.

#### Scenario: Referencia cross-repo
- **WHEN** un commit menciona `fethabo/otro-repo#10`
- **THEN** la salida contiene `[fethabo/otro-repo#10](https://github.com/fethabo/otro-repo/issues/10)` y ningún link anidado o duplicado

### Requirement: Plain-text fallback without baseUrl
Cuando no hay `baseUrl` disponible, las referencias `#<num>` SHALL permanecer como texto plano. El formato roto previo `([#<num>](#<num>))` SHALL eliminarse.

#### Scenario: Repo sin campo repository en package.json
- **WHEN** `getRepositoryBaseUrl()` devuelve cadena vacía y un commit menciona `#5`
- **THEN** la salida contiene `#5` sin sintaxis de link
