---
sessionID: ses_ebb63e47dffeZGt76vX86OWIUC
baseMessageCount: 84
updatedAt: 2026-10-16T12:15:59.582Z
version: 1.0
date_created: 2026-10-16
owner: agent
tags: [spec, diagnostic]
consumedState: ef0e64b4fa51fa282c9726622c42c33ab8cf895e85bcfb5ce6ee57381df0ad34
status: complete
---

# Betrouwbare decision-layer-doorstroom

## Current spec

# Introduction
Deze spec beschrijft de opt-in overdracht van een afgerond `/interview` naar het decision-register en naar vervolgagents. Een markdown spec alleen is geen bewijs van registratie.

## 1. Purpose & Scope
Voor ontwikkelaars en agents die aan een expliciet gekoppelde interview-spec werken. Binnen scope: registratie na afronding, herstel bij fouten en handoff naar `/implement` of agents voor die spec. Buiten scope: gewone gesprekken, andere agenttaken, presets en modellen.
Aanname (nog onbewezen): de host biedt een bruikbaar aanknopingspunt om na `confirm-complete` een registratie-stap te starten; de huidige code bewijst alleen dat de spec compleet wordt gemarkeerd.

## 2. Definitions
Register: `.decisions/register.yaml` (of het geconfigureerde repository-pad). Promotie: spec-inhoud omzetten in onderbouwde voorgestelde records. Handoff: spec-pad en relevante record-ID’s meegeven aan een gekoppelde vervolgopdracht. `proposed`: nog niet door de eigenaar geratificeerd.

## 3. Requirements, Constraints & Guidelines
- **REQ-001**: Na expliciet afronden wordt de spec direct `complete`; registratie loopt daarna als afzonderlijke stap en meldt voltooiing of een zichtbare fout met herstelmogelijkheid. Zonder bestaand register: vraag expliciet om `decision-init`, maar voer het niet automatisch uit.
- **REQ-002**: Registratie leest eerst bestaande records via `decision-list` en waar nodig `decision-query`; voeg alleen gerechtvaardigde nieuwe REQ/CONSTRAINT/ASSUMPTION/DEC toe, hergebruik relevante ID’s en voorkom duplicaten bij herhaling.
- **REQ-003**: Na schrijven volgt `decision-validate`; rapporteer hergebruikte en nieuwe ID’s en resterende open vragen. De spec-status mag nooit ten onrechte registratie-succes impliceren.
- **REQ-004**: Alleen `/implement` en expliciet aan déze interview-spec gekoppelde agents krijgen een handoff met spec-pad, relevante ID’s en open aannames; zij raadplegen het register en stellen nieuwe bevindingen via tools voor. Bij registratiefout mag `/implement` doorgaan met een duidelijke waarschuwing en zonder verzonnen ID’s.
- **REQ-005**: Een normaal gesprek en ongerelateerd agentwerk maken niet automatisch records aan; schrijfdiscipline wordt alleen in de afgebakende opt-in workflow geactiveerd.
- **REQ-006**: Bij ontbreken van een register wordt geen register automatisch aangemaakt; toon de noodzakelijke expliciete `decision-init`-stap en bied daarna een herstelpoging aan.
- **REQ-007**: Als een aangepaste spec opnieuw wordt afgerond, registreer alleen nieuwe onderbouwde inhoud. Vervang of supersede bestaande records niet automatisch; meld afwijkingen en tegenstrijdigheden ter beoordeling.
- **SEC-001**: Agents bewerken het register nooit handmatig; gebruik uitsluitend `decision-*` tools. Ratify of reject uitsluitend op expliciet verzoek van de eigenaar.
- **CON-001**: Bestaande keuzes `CONSTRAINT-0001` (opt-in), `DEC-0001` (vaste pointer), `DEC-0002` (config per key) en `DEC-0003` (neutrale toolbeschrijvingen) blijven uitgangspunt; nieuwe records blijven `proposed`.
- **CON-002**: Bij een latere OpenCode-configwijziging eerst `.json` én `.jsonc` controleren en vóór iedere wijziging een backup maken.
- **CON-003**: Een interview vereist niet automatisch één record van elk type; onzekere claims worden als aannames behandeld.
- **GUD-001**: Houd de spec en het register bij hun eigen rol: de spec beschrijft het werk, het register legt de onderliggende besluiten vast; geen tweede registerkopie in de handoff.

## 4. Interfaces & Data Contracts
De bestaande `decision-list`, `decision-query`, `decision-add` en `decision-validate` zijn de bekende toolinterface (`src/tools/index.ts`). Definieer in de implementatiefase een expliciete registratie-uitkomst met spec-identiteit, status (geslaagd/mislukt), hergebruikte en nieuw aangemaakte ID’s en foutreden; opslagvorm en API-signatuur zijn nog niet vastgesteld. De handoff bevat spec-pad, record-ID’s en open aannames, geen gekopieerde registerinhoud.

## 5. Acceptance Criteria
- **AC-001**: Given een afgerond interview met bestaande registerrecords, When registratie loopt, Then blijven de spec-status `complete` en de bestaande relevante ID’s behouden en worden alleen ontbrekende gerechtvaardigde records `proposed` toegevoegd.
- **AC-002**: Given een voltooide spec, When de registratietool faalt, Then blijft de spec compleet, verschijnt een zichtbare fout en is herstel mogelijk zonder stilzwijgende succesclaim.
- **AC-003**: Given dezelfde spec en eerder geregistreerde uitkomst, When registratie opnieuw loopt, Then ontstaan geen dubbele records.
- **AC-004**: Given een aan de spec gekoppelde `/implement`- of agenttaak, When de taak start, Then bevat een geslaagde handoff de relevante ID’s en open aannames; een niet-gekoppelde taak krijgt geen schrijfinstructie.
- **AC-005**: Given een gewoon gesprek, When een requirement ter sprake komt, Then maakt de plugin zonder expliciete opt-in opdracht geen record.
- **AC-006**: Given een voltooide spec zonder bestaand register, When registratie wordt geprobeerd, Then vraagt het systeem om expliciete `decision-init` en maakt niets automatisch aan.
- **AC-007**: Given een mislukte registratie, When `/implement` start, Then gaat implementatie door met zichtbare waarschuwing en zonder fictieve record-ID’s.
- **AC-008**: Given een gewijzigde spec met een eerdere registratie, When deze opnieuw wordt afgerond, Then worden alleen werkelijk nieuwe voorstellen toegevoegd, blijven oude records ongewijzigd en worden conflicten zichtbaar gemeld.

## 6. Test Automation Strategy
Gebruik de bestaande Bun-tests met mocks voor hooks, interviewafronding en decision-tools; toets configuratie uit/aan, ontbrekend register zonder automatische `decision-init`, bestaande records, herhaling, gewijzigde spec met conflict zonder automatische supersede, validatie- en toolfouten, waarschuwing bij doorgaande `/implement` en handoff-scope. Test daarna één echte interview-naar-register-naar-vervolgagent-keten; componenttests alleen bewijzen geen agentnaleving.

## 7. Rationale & Context
Na afronden registreren voorkomt dat toolfouten de spec blokkeren, maar vereist een afzonderlijke zichtbare registratiestatus. De huidige interviewprompt is slechts tekst; de v2-marker komt voor in de kickoff en is geen voltooiingssignaal (`src/v2/setup.ts:157-165`; `oh-my-opencode-slim/src/interview/prompts.ts:122-142`). De vaste pointer kan normale gesprekken hoogstens tot lezen aansporen, niet automatisch tot schrijven.

## 8. Dependencies & External Integrations
- **EXT-001**: oh-my-opencode-slim `/interview` markeert de markdown spec compleet bij `confirm-complete` en `/implement` leest die spec (`src/interview/service.ts:1939-1965`; `src/interview/prompts.ts:284-292`, in de lokale oh-my-opencode-slim checkout). Een betrouwbare post-completion trigger en agent-handoff moeten nog worden ontworpen en bewezen.

## 9. Examples & Edge Cases
Voorbeeld: een spec bevat één nieuwe eis en verwijst naar een bestaand constraint-ID. De stap hergebruikt dat ID, voegt via `decision-add` uitsluitend de eis als `proposed` toe en valideert. Zonder register: vraag expliciet om `decision-init`, wacht en bied daarna retry; bij uitgeschakelde discipline geen ongevraagde registratie. Bij fout mag `/implement` met waarschuwing doorgaan. Wijzigt de spec later in strijd met het bestaande constraint-record, meld het conflict en supersede niets automatisch.

## 10. Validation Criteria
Controleer de formele schema-validatie en de werkelijk geregistreerde IDs tegen de voltooide spec; verifieer een foutmelding en retry zonder dubbelen, plus dat normale gesprekken geen records creëren. Bevestig de hookvolgorde en toolaanroepen in een live end-to-end proef voordat betrouwbaarheid wordt geclaimd.

## 11. Related Specifications / Further Reading
`.decisions/register.yaml`; `schema/register.schema.json`; `skills/decision-layer/SKILL.md`; `src/hooks/interview-inject.ts`; `src/v2/setup.ts`; `src/prompts/register-pointer.ts`; `README.md`; onderzoek `~/projects/opencode-agents/research/2026-10-16-decision-layer-interview-agent-doorstroom.md`.

## Q&A history

Q: Wanneer moet de registratie-stap lopen ten opzichte van ‘interview afronden’?
A: Na afronden: spec direct compleet, registratie daarna met zichtbare foutmelding en herstelmogelijkheid (aanbevolen).

Q: Welke vervolgopdrachten krijgen standaard de decision-layer-handoff?
A: Alleen `/implement` en agents die voor die specifieke interview-spec werken (aanbevolen).

Q: Wat moet de registratie-stap doen als in het interviewproject nog geen register bestaat?
A: Melden en expliciet om `decision-init` vragen; niets automatisch aanmaken (aanbevolen).

Q: Mag `/implement` starten als de post-interviewregistratie mislukt is?
A: Ja, met duidelijke waarschuwing en zonder fictieve record-ID’s (aanbevolen).

Q: Als een afgeronde interviewspec later wijzigt en opnieuw wordt afgerond, wat moet er met eerder voorgestelde records gebeuren?
A: Nieuwe inhoud registreren, bestaande records niet automatisch vervangen; wijziging ter beoordeling melden (aanbevolen).
