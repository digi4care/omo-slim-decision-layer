---
sessionID: ses_ebb63e47dffeZGt76vX86OWIUC
baseMessageCount: 97
updatedAt: 2026-10-16T14:52:43.993Z
version: 1.0
date_created: 2026-10-16
owner: agent
tags: [spec, diagnostic]
consumedState: 8d83e28d0e6c98bb967bfd942a67872a6cbc2abe8493944bd2923eb155c1a52e
status: complete
---

# Workflow en traceability opnieuw ontwerpen

## Current spec

# Introduction
Deze interviewspec onderzoekt opnieuw hoe Chris als veelal solo-developer kleine tot zeer grote projecten bestuurt met OpenCode, oh-my-opencode-slim (OMO), decision-layer en eventueel beads. Het doel is eerst de werkelijke werking en behoeftes vast te stellen, daarna pas een proportionele workflow te ontwerpen; dit interview autoriseert geen wijzigingen.

## 1. Purpose & Scope
Doelgroep: Chris en agents die projecten over sessies en fasen heen uitvoeren. Scope: van idee en onderzoek via requirements, aannames, besluiten, taken, implementatie en verificatie tot latere herleidbaarheid voor mens en AI. Vergelijk kleine, middelgrote, grote en langlopende projecten zonder voor elk dezelfde overhead te veronderstellen. OpenCode is het technische kader; OMO en decision-layer zijn aanvullingen daarop. Read-only praktijkcasussen: Chris' Mnemosyne-vs-Hindsight-project én zijn decision-layer-project; de OMO-repo uitsluitend read-only voor technische verificatie, niet als project waarin Chris verder wil werken. Buiten scope: nu code, config, registerstatus of beads-issues wijzigen; presets, modelkeuze, releasewerk en voorstellen voor OMO-repowijzigingen.
Aanname om te toetsen: duurzame traceability is vooral bij langlopende projecten waardevol, maar de juiste ondergrens en granulariteit zijn nog onbekend.

## 2. Definitions
`/interview`: specificatiegesprek met markdown-document als output. Decision-register: `.decisions/register.yaml` voor requirements, constraints, assumptions en decisions, niet voor werkstatus. Beads (`br`): taak-/issueadministratie bij meer dan één afzonderlijke wijzigingsronde met eigen resultaat of bij delegatie, ongeacht projectgrootte; één samenhangende code-/configwijziging telt als één bewerkingsstap, ook over meerdere bestanden; testen en review tellen niet als extra bewerkingsstap. `/implement`: OMO-command dat een voltooide interviewspec laat uitvoeren. `/deepwork`: meerfasige OMO-workflow met eigen voortgangsbestanden. Traceability: bij groot werk de herleidbare keten bron → actueel besluit/aanname → taak-ID met status → code/commit en test/evidence; bij klein werk proportioneel lichter.

## 3. Requirements, Constraints & Guidelines
- **REQ-001**: Reconstrueer per stap wie (eigenaar, orchestrator, specialist of tool) wat vastlegt, waar de bron van waarheid staat, wanneer dat gebeurt, en wie mag bevestigen of herzien.
- **REQ-002**: Onderzoek de feitelijke OpenCode/OMO/decision-layer-workflow en vergelijk die met de bedoelde workflow; benoem technische garanties, agentinstructies en ontbrekende koppelingen afzonderlijk.
- **REQ-003**: Ontwerp proportionele routes voor klein, middelgroot, groot en langlopend werk, inclusief criteria voor interview, direct werk, deepwork, registergebruik en beads. Start `/interview` bij onduidelijke requirements of bepalende ontwerpkeuzes, ongeacht projectgrootte; heldere kleine taken kunnen direct worden opgepakt.
- **REQ-004**: Maak traceability voor zowel Chris als een nieuwe AI-sessie toetsbaar, inclusief duplicaten, veranderende besluiten, open aannames en de overdracht naar agents.
- **REQ-005**: Bij groot werk moet een mens of nieuwe AI-sessie de volledige keten van bron via besluit en taak naar code/commit en test kunnen volgen, met IDs en actuele status; voor kleine wijzigingen mag een kortere keten volstaan.
- **REQ-006**: Gebruik beads standaard bij meer dan één afzonderlijke wijzigingsronde met eigen resultaat of bij delegatie, ook in een klein project. Eén samenhangende wijziging in één of meer bestanden plus testen/review telt als één bewerkingsstap en kan zonder bead; onderzoek hoe de keuze vóór dispatch wordt gecontroleerd, want OMO dwingt haar nu niet af.
- **REQ-007**: Als meerstaps- of gedelegeerd werk begint zonder `.beads/`, stop vóór het verdelen van implementatiewerk en vraag Chris expliciet toestemming voor `br init`; maak de workspace niet stilzwijgend aan. Als Chris geen toestemming geeft, blijft het werk gepauzeerd totdat taaktracking is geregeld.
- **REQ-008**: Het afronden van een expliciet gestart `/interview` in een project met bestaand decision-register geldt als opt-in om uit dat interview onderbouwde records als `proposed` toe te voegen. Ratify/reject nooit automatisch; controleer bestaande records en rapporteer ontbrekende of mislukte promotie zichtbaar. Zijn er wel onderbouwde nieuwe punten maar geen geldig `decision-record-proposals`-blok, schrijf dan geen records en vraag zichtbaar om review en herstel; interviewafronding blijft mogelijk. Toon na afronding de spec, registratie-uitkomst en eventuele open gates; Chris start `/implement` apart en expliciet, niet automatisch.
- **REQ-009**: Wanneer tijdens implementatie een nieuw architectuurbesluit nodig blijkt, pauzeert de agent vóór de betrokken codewijziging en vraagt Chris om een besluit; de agent mag dat besluit niet vervangen door alleen een `proposed` record of een taaknotitie. De grens met kleine uitvoeringskeuzes binnen bestaande kaders wordt in de workflow uitgewerkt.
- **REQ-010**: Begin niet met implementatie die afhangt van een bepalende architectuurkeuze (structurele grenzen, data-/interfacecontracten of moeilijk omkeerbare keuzes) voordat die keuze als record in een decision-register is vastgelegd en Chris het via de decision-tools heeft geratificeerd. Ontbreekt het register, vraag eerst toestemming voor initialisatie; een akkoord in gesprek of spec vervangt het geaccepteerde record niet. Lokale uitvoeringsdetails vallen niet automatisch onder deze gate; overige `proposed` records mogen zichtbaar open blijven. Dit is gekozen beleid, nog geen aangetoonde technische gate.
- **REQ-011**: Bij groot werk legt de agent controleerbare bron-, record-, taak-, code- en testverwijzingen vast met beschikbare tools; Chris beoordeelt bepalende beslissingen en uitzonderingen, niet elke link afzonderlijk. Veronderstel geen automatische linkcreatie die de huidige tools niet aantoonbaar bieden.
- **REQ-012**: Onderzoek technische blokkering van de beads- en architectuurgates binnen OpenCode of een eigen plugin zonder OMO te wijzigen. Implementeer die later alleen waar het hostcontract en een gerichte proef betrouwbare afdwinging aantonen; waar dat niet kan, verplicht een expliciet zichtbaar stopmoment in de agentworkflow en benoem het restrisico. Bij onzekerheid over een benodigde architectuurkeuze onderzoekt de agent eerst bron en register; blijft twijfel bestaan, dan pauzeert uitsluitend de betrokken wijziging en vraagt Chris.
- **REQ-013**: Plan ná dit read-only interview voor beide eigen projecten historische backfill van alle betekenisvolle specs, besluiten en taken, met hun relevante commits; maak niet voor iedere triviale commit een besluit of bead. Label lacunes die historische bronnen niet bewijzen; een later aangemaakte bead mag alleen expliciet als retrospectieve reconstructie verschijnen, nooit als oorspronkelijk issue, en met ontbrekende bron/test als onbekend. Verzin geen oude besluiten, datums, uitvoeringsstatus of testresultaten. Voor `br init`, retrospectieve issues en registerwijzigingen blijft afzonderlijke toestemming vereist.
- **REQ-014**: Onderzoek en herstel in een afzonderlijke, later expliciet gestarte bugfix de letterlijk door Chris waargenomen `Project root does not match configured project`-weigering bij interviewpromotie. Bepaal voor elk werkelijk hostpad één consistente, veilige projectroot-resolutie; vergelijk toegestane roots pas na canonicalisatie en accepteer uitsluitend dezelfde root, nooit alleen een prefix, parent of willekeurige andere repo. Reproduceer nog welke hostinput en welk uitvoeringspad de ongelijkheid veroorzaakten; wijzig in dit interview geen code.
- **SEC-001**: Geen automatische ratify/reject, geen handmatige register-edits en geen ongewenste recordcreatie in gewone gesprekken; registratie blijft opt-in.
- **CON-001**: Baseer uitspraken over OpenCode-host en plugins op geverifieerde lokale code/gedrag of officiële documentatie; presenteer ongetest agentgedrag niet als garantie.
- **CON-002**: Dit interview onderzoekt en specificeert alleen. Wijzig geen code, config, registerrecords of beads; onderzoek van presets/modellen valt erbuiten. Als later configwijziging wordt voorgesteld, eerst `.json` én `.jsonc` controleren en vóór iedere wijziging een backup.
- **GUD-001**: Toets aan software-designprincipes en AI-ontwikkelpraktijken; gebruik ArXiv gericht wanneer empirische claims of trade-offs werkelijk om onderzoek vragen, niet als decoratie.
- **GUD-002**: Minimaliseer administratie bij klein werk; vermijd een tweede waarheid door de rollen van spec, register, beads, code en tests scherp te scheiden.

## 4. Interfaces & Data Contracts
Eigenaarschap van waarheid: interviewspec of expliciete opdracht = bron en scope; decision-register = requirements, aannames en door Chris geratificeerde bepalende keuzes; bead = uitvoeringsstatus; Git = daadwerkelijke codewijziging; tests = verificatie. Deepwork-progress is coördinatie, geen vervanging voor register of bead. Een agent legt de concrete identifiers en verwijzingen vast waar de bestaande interfaces dit ondersteunen en meldt ontbrekende schakels; Chris ratificeert uitsluitend expliciet. De bestaande decision-layer `external`-link kan een beads-ID aanwijzen (`src/model/record.ts:51-60`); dit maakt nog geen bead, commit- of testlink vanzelf. Te verifiëren vóór implementatie van koppelingen: OpenCode-hookcontract, `decision-*`-tools, interviewbronpad, beads-ID en beschikbare Git/testverwijzingen. Geen nieuwe API of automatisch invulbaar veld veronderstellen.

## 5. Acceptance Criteria
- **AC-001**: Given een klein concreet werkitem, When de workflow wordt toegepast, Then blijft de overhead beperkt en is duidelijk of spec, register en beads überhaupt nodig zijn.
- **AC-002**: Given een langlopend project met gewijzigde aannames, When Chris of een nieuwe agent vraagt waarom code bestaat, Then is de volledige keten bron → actueel besluit/aanname → taak-ID en status → code/commit → test/evidence vindbaar zonder sessiegeheugen.
- **AC-003**: Given een interview of gedelegeerde agent ontdekt een nieuwe keuze, When werk wordt overgedragen, Then is expliciet of die keuze slechts tekst, een voorgesteld record of een door Chris geaccepteerd besluit is.
- **AC-004**: Given een gewoon gesprek zonder opt-in, When requirements worden besproken, Then ontstaan niet automatisch decision-records of beads-issues.
- **AC-005**: Given een voorstel voor een workflow, When het met lokale code en relevante evidence wordt vergeleken, Then zijn feit, aanname, trade-off en onbewezen runtime-gedrag apart benoemd.
- **AC-006**: Given een meerstaps- of gedelegeerde implementatie in een repo zonder `.beads/`, When de orchestrator werk wil verdelen, Then stopt die vóór implementatiewerk en vraagt expliciet toestemming voor `br init`; alleen een interviewspec of sessieplan telt niet als taakregistratie.
- **AC-007**: Given een afgerond expliciet `/interview` met onderbouwde nieuwe kandidaten en een bestaand register, When de interview-handoff plaatsvindt, Then kunnen uitsluitend `proposed` records met bronverwijzing ontstaan en wordt de uitkomst zichtbaar; geen enkel record wordt automatisch geratificeerd of verworpen.
- **AC-008**: Given een afgerond interview met onderbouwde nieuwe punten maar zonder geldig kandidaatblok, When de registratie wordt beoordeeld, Then blijft de spec afgerond, blijft het register ongewijzigd en verschijnt een concreet verzoek om review en herstel.
- **AC-009**: Given een implementerende agent stuit op een nog onbeslist architectuurvraagstuk, When de keuze de code zou bepalen, Then pauzeert de agent vóór die codewijziging en vraagt Chris om een beslissing.
- **AC-010**: Given Chris weigert `br init` bij meerstaps- of gedelegeerd werk zonder bestaande beads-workspace, When implementatie wordt overwogen, Then blijft dat werk gepauzeerd totdat taaktracking is geregeld.
- **AC-011**: Given een bepalende architectuurkeuze staat slechts op `proposed` of er is geen register, When implementatie daarvan afhangt, Then begint het afhankelijke werk pas na registratie en expliciete ratificatie door Chris via de decision-tools; niet-bepalende voorstellen blokkeren ander werk niet automatisch.
- **AC-012**: Given Chris rondt een interview af, When de registratie-uitkomst bekend is, Then ziet hij het spec-pad, eventuele nieuwe of hergebruikte records, ontbrekende schakels en de aparte volgende stap `/implement`; er start geen implementatie vanzelf.
- **AC-013**: Given groot werk is afgerond, When Chris of een nieuwe agent een bead en bijbehorende code bekijkt, Then zijn de verwijzingen naar bron, actueel besluit en testbewijs controleerbaar zonder dat Chris iedere koppeling handmatig heeft ingevoerd.
- **AC-014**: Given een agent kan na raadpleging van bron en register niet bepalen of een wijziging een bepalende architectuurkeuze vereist, When uitvoering begint, Then pauzeert alleen die afhankelijke wijziging en vraagt de agent Chris; onafhankelijk werk blijft mogelijk.
- **AC-015**: Given eerder werk in beide eigen projecten, When het latere backfill-traject plaatsvindt, Then zijn alle betekenisvolle specs, besluiten en taken en hun relevante commits geïnventariseerd, zijn verifieerbare links aangevuld na toestemming, en markeren retrospectieve beads hun reconstructie en ontbrekend bewijs expliciet; triviale commits worden niet kunstmatig tot besluit of taak verheven.
- **AC-016**: Given `ctx.worktree` en `ctx.location.directory` verschillende geldige paden zijn, When `decision-promote-interview` promoveert met de projectroot die de decision-tools voor die sessie bepalen, Then wordt dezelfde projectroot na veilige canonicalisatie niet ten onrechte geweigerd; een werkelijk andere projectroot wordt ook na canonicalisatie nog geweigerd, inclusief een parent- of prefixverwante repo.

## 6. Test Automation Strategy
Eerst read-only broninspectie van de twee eigen repo's en OMO als afhankelijkheid; benoem actuele gaten in plaats van een end-to-end bewijs te veinzen. Een latere implementatie vraagt gerichte tests voor opt-in/afwezig register, kandidaatloos interview, idempotente promotie, toestemming voor `br init`, grens één versus meerdere code-/configbewerkingen, een ongeratificeerd bepalend besluit, en onbekende classificatie. Voor de specifieke rootbug: test per v1/v2-context de door tools en bridge gebruikte root bij verschillend `worktree`/`location.directory`, een equivalent canoniek pad en een echt andere repo; behoud weigering voor symlink-/parent-/prefixvarianten die buiten het toegestane project vallen. Volg met een echte OpenCode-hostproef en een traceability-scenario van bron tot test. Dit interview voert geen tests met state-mutaties uit en certificeert geen technisch gatecontract.

## 7. Rationale & Context
Read-only broninspectie: OMO zet bij `confirm-complete` de spec op `complete`, meldt het spec-pad en probeert de optionele decision bridge; de registratie-uitkomst wordt apart gemeld (`src/interview/service.ts:1952-1989`). `/implement` leest de spec maar creëert geen beads-issues (`src/interview/prompts.ts:293-301`). Deepwork gebruikt eigen voortgangsbestanden zonder beads-gate (`src/skills/deepwork/SKILL.md:106-115`). Decision-layer leest alleen het getypeerde YAML-kandidaatblok uit `## Current spec`; zonder blok volgt `needs-review` zonder write (`src/tools/interview-promotion.ts:53-79,138-145`). Het linkmodel kent `external`-verwijzingen, ook naar beads, maar schrijft die niet vanzelf (`src/model/record.ts:51-60`). In de twee eigen projecten zijn de gecontroleerde registerlinks leeg; een `.beads/`-workspace is niet aangetroffen. De volledige bron → besluit → bead → code/test-keten is dus niet aangetoond. Dit is inspectie van de huidige code en artefacten, geen runtimegarantie voor alle hostinstallaties. Chris kiest nu: structurele grenzen, data-/interfacecontracten en moeilijk omkeerbare keuzes vragen register en ratificatie; ontbrekende beads houden meerstapswerk tegen; onduidelijke requirements of zulke ontwerpkeuzes starten `/interview`; agents leggen links vast, Chris beoordeelt gates en uitzonderingen; afronding toont resultaat maar start `/implement` nooit automatisch. Onderzoek beide eigen projecten als casus en OMO alleen read-only; geen OMO-repowijzigingen. `CONSTRAINT-0001` en `DEC-0001`–`0003` zijn accepted; `REQ-0001`, `DEC-0004` en `ASSUMPTION-0002` blijven proposed. Let op: het bestaande proposed `DEC-0004` zegt dat `/implement` met waarschuwing mag doorgaan bij registratieproblemen; dat is niet verenigbaar met de nieuwe gate voor werk dat van een ongeratificeerde bepalende keuze afhangt. Bespreek deze wijziging expliciet; wijzig of supersede het record niet in dit interview.

Chris bevestigt dat hij de exacte melding `Project root does not match configured project` bij het mislukte interview zag. De huidige lokale code bevat die tekst in de afwijzing van de v2-bridge (`src/v2/setup.ts:93-103`), die `ctx.location.directory` ruw vergelijkt met `input.projectRoot`; `src/tools/paths.ts:23-41` laat gewone toolcontexts eerst `ctx.worktree` kiezen. Belangrijke nuance: de v2 tooladapter zet `worktree` én `directory` zelf op de setup-root (`src/v2/setup.ts:123-138`), dus verschillende oorspronkelijke velden alléén verklaren de fout nog niet. `src/tools/index.ts:135-145` gebruikt de algemene resolver. De gemelde weigering is een concrete observatie van Chris; de precieze waarden en hostroute zijn niet uit sessielogs gereproduceerd en blijven onderzoekspunt.

Statusupdate 2026-10-16 (ná het read-only interview): bovenstaande codebeschrijving is historisch en beschrijft niet meer de huidige build. De bugfix kiest een canonieke v2-projectroot en registreert geladen v1/v2-roots in een gedeelde bridge (`src/v2/setup.ts`, `src/index.ts`, `src/tools/interview-bridge.ts`). Na de laatste wijziging slagen 166 tests; de herstartte OpenCode-host gaf in het Mnemosyne-project via `decision-promote-interview` op een complete spec zonder voorstellen `needs-review: No explicit proposals found under ## Current spec`, niet de oude rootfout. Het register bleef ongewijzigd. De automatische *completion-eventroute* van dit workflow-interview is daarmee nog niet live bewezen. Chris koos voor exact geregistreerde canonieke roots, niet voor strikte callerisolatie tussen twee geladen projecten. Dit updatebericht verandert geen registerstatus en autoriseert geen implementatie.

Ontwerpafweging: één bron per soort waarheid voorkomt dat spec, register, bead en Git elkaar als concurrerende statusbronnen tegenspreken. Schrijf niet meer permanente records dan later nuttig zijn; accepteer juist extra traceability voor langlopende/risicovolle verandering. Gebruik ArXiv alleen als een volgende fase een concrete empirische stelling wil toetsen; de huidige scheiding is een ontwerpkeuze, geen door literatuur bewezen AI-effect. Open kwestie voor later: welke OpenCode-hooks kunnen betrouwbaar blokkeren zonder OMO-code te wijzigen?

Onderbouwd voorstel voor het decision-layer-project (geen ratificatie, geen voorstel om OMO aan te passen):
```decision-record-proposals
- key: workflow-traceability-across-artifacts
  type: REQ
  title: Maak bron-tot-verificatie-traceability controleerbaar bij groot werk
  context: Chris koos in dit interview expliciet voor een herleidbare keten bron via besluit en bead/status naar code en test, met agenten als linkbeheerder en Chris als beoordelaar van bepalende beslissingen en uitzonderingen. De huidige registers hebben bij gecontroleerde records lege links en de projecten hebben geen beads-workspace; de keten is dus een gewenste nieuwe eis, niet bestaand gedrag of een duplicaat van REQ-0001 over interviewpromotie.
- key: interview-promotion-projectroot-consistency
  type: REQ
  title: Gebruik dezelfde veilige projectroot voor decision-tools en interviewpromotie
  context: Chris bevestigde in dit interview dat hij letterlijk `Project root does not match configured project` zag. Na het interview is de code hersteld en zijn v1/v2-regressietests en een live directe toolproef uitgevoerd. Deze eis legt de gewenste veilige rootconsistentie vast; de automatische interview-completion-eventroute moet nog afzonderlijk live worden geverifieerd. Alleen geregistreerde canonieke projectroots zijn toegestaan; een onbekende repo blijft geweigerd, maar tussen twee geladen projecten is geen strikte callerisolatie mogelijk zonder extra hostidentiteit.
```

## 8. Dependencies & External Integrations
- **EXT-001**: OpenCode als host begrenst plugin-hooks, tools, sessies en permissies; de gebruikte hostversie en API moeten expliciet worden geverifieerd waar gedrag ertoe doet.
- **EXT-002**: OMO levert interview-/implement-/deepwork-routes; hun exacte contracts volgen uit read-only lokale broncode, niet uit de naam van de commands. De OMO-repo is geen ontwikkeldoel in deze workflow.
- **EXT-003**: Decision-layer-register en optionele beads-workspace hebben verschillende levenscycli en moeten niet stilzwijgend worden aangemaakt.
- **EXT-004**: ArXiv en software-designliteratuur alleen voor afgebakende externe claims; resultaten met datum, toepassingsgebied en onzekerheid vastleggen.

## 9. Examples & Edge Cases
Voorgestelde route (beleid, niet reeds afgedwongen OpenCode-functionaliteit):

| Werk | Instap | Duurzame artefacten | Stopmoment |
| --- | --- | --- | --- |
| Klein en helder, één code-/configbewerking | Direct; test/review tellen niet extra | Code en test; geen verplichte interview/bead | Alleen bij onverwachte bepalende keuze |
| Klein of middelgroot met meerdere afzonderlijke wijzigingsrondes of delegatie | Direct of `/interview` bij onduidelijkheid | Bead met status; spec alleen als uitvraag nodig is; register alleen voor bepalende keuze of duurzaam relevante claim | Vraag `br init` bij ontbrekende workspace; bij architectuurkeuze eerst register en ratificatie |
| Groot of langlopend | `/interview` voor onzekerheden; `/deepwork` alleen bij langdurige afhankelijke fasen, niet omdat de repo groot is | Bron, register, beads, code/commit en testbewijs met expliciete koppelingen | Nieuwe bepalende keuze, ontbrekende toestemming of onzekere classificatie van afhankelijke wijziging |

Een typo-fix met één samenhangende codewijziging kan direct plus test/review zonder bead, ook wanneer twee bestanden bij dezelfde wijziging horen. Twee afzonderlijke rondes met eigen resultaat of delegatie activeren beads, ook bij klein werk. Een afgerond interview zonder geldig voorstel vraagt zichtbare review zonder registerwrite; de spec blijft bruikbaar, maar werk dat afhangt van een ongeratificeerde bepalende keuze blijft gepauzeerd. Een agent onderzoekt bij twijfel eerst bron en register en vraagt Chris alleen wanneer de onzekerheid blijft. Herontdekte keuzes en weerlegde aannames vragen bestaande records raadplegen, niet stilzwijgend dupliceren of overschrijven. Historische backfill wordt een afzonderlijke, expliciet goedgekeurde klus voor beide eigen projecten: bijvoorbeeld een oude betekenisvolle spec en haar commits met een nu aangemaakte bead, herkenbaar als retrospectief en zonder verzonnen oorspronkelijke datum, status of testbewijs.

## 10. Validation Criteria
Het uiteindelijke voorstel moet per projectgrootte een herkenbare instap, uitgangen en escalatiecriteria geven; aantonen waar elke soort waarheid leeft; expliciet maken wat technisch wordt afgedwongen en wat aan een agent wordt gevraagd; en read-only in zowel het Mnemosyne-vs-Hindsight-project als decision-layer concrete traceability-paden en hiaten toetsen. OMO dient alleen als technische referentie. Stop bij ontbrekende schakels met een toetsplan, niet met een verzonnen end-to-end garantie.

## 11. Related Specifications / Further Reading
`.decisions/register.yaml`, `schema/register.schema.json`, `skills/decision-layer/SKILL.md` en `src/` in decision-layer; `src/interview/` en `src/skills/deepwork/SKILL.md` in de lokale OMO-repo (read-only); `~/projects/opencode-agents/research/2026-10-16-decision-layer-interview-agent-doorstroom.md`, `2026-10-16-mnemosyne-interview-decision-handoff.md` en `2026-10-16-omo-decision-beads-workflow-heranalyse.md`.

## Q&A history

Q: Welke herleidbaarheid moet de uiteindelijke workflow minimaal leveren in een groot project?
A: Bron → besluit → taak → code/test, met IDs en actuele status (aanbevolen).

Q: Wanneer wil je beads als standaard werkadministratie?
A: Bij meerstaps- of gedelegeerd werk, ongeacht projectgrootte (aanbevolen).

Q: Wat moet er gebeuren als meerstapswerk begint in een repo zonder `.beads/`?
A: Stoppen en expliciet toestemming vragen voor `br init` (aanbevolen).

Q: Geldt het afronden van `/interview` in een project met bestaand register als toestemming om onderbouwde records als `proposed` toe te voegen?
A: Ja, automatisch proposed; nooit ratify (aanbevolen).

Q: Wat moet een afgerond interview doen als er wél onderbouwde nieuwe punten in de tekst staan, maar geen geldig `decision-record-proposals`-blok?
A: Niet schrijven; zichtbaar review en herstel vragen

Q: Wat mag een implementerende agent doen wanneer tijdens het bouwen een nieuw architectuurbesluit nodig blijkt?
A: Pauzeren en jou laten beslissen vóór de code verandert

Q: Mag implementatie beginnen met relevante `proposed` decision-records, of wil je dat je ze eerst expliciet accepteert?
A: Alleen accepted voor bepalende keuzes; overige proposed mogen open blijven

Q: Als je toestemming voor `br init` niet geeft bij meerstapswerk, wat is dan de uitkomst?
A: Werk pauzeren tot taaktracking is geregeld

Q: Wat betekent 'geaccepteerd' voor een bepalende architectuurkeuze in een project zonder decision-register?
A: Altijd eerst een register opzetten en het record ratificeren

Q: Welk bestaand project wil je als read-only casus voor de end-to-end toets van de workflow?
A: bedie maar niet dew OMO repo die is niet van mij en daar ga ik ook niet in werken verder

Q: Welke keuzes moeten als 'bepalend architectuurbesluit' eerst in het register worden geratificeerd?
A: Structurele grenzen/data/interfaces en moeilijk omkeerbare keuzes

Q: Wat moet de zichtbare volgende stap zijn na een afgerond interview, naast registratie?
A: Resultaat tonen en jou apart laten starten met `/implement`

Q: Wanneer wil je voor nieuw werk standaard `/interview` starten, in plaats van direct werken?
A: Bij onduidelijke requirements of bepalende ontwerpkeuzes, ongeacht projectgrootte

Q: Hoeveel handmatige administratie wil je voor de volledige keten bij groot werk accepteren?
A: Agent legt links vast; jij controleert alleen gates en uitzonderingen

Q: Wat telt voor jou als 'meerstapswerk' dat beads activeert?
A: Elke taak met meer dan één bewerkingsstap

Q: Wil je de gekozen beads- en architectuurgates uiteindelijk technisch laten blokkeren waar dat binnen jouw eigen plugin/OpenCode kan, of volstaat zichtbare agentdiscipline?
A: Technische gate waar mogelijk; anders expliciet stopmoment

Q: Je koos beads bij elke taak met meer dan één bewerkingsstap: telt een codewijziging gevolgd door testen of review als twee stappen?
A: Nee, alleen afzonderlijke code-/configwijzigingen tellen

Q: Als een technische gate niet zeker kan bepalen of een taak een architectuurbesluit vereist, wat moet er dan gebeuren?
A: Agent eerst zelf onderzoeken; alleen bij resttwijfel vragen

Q: Is één taak die twee bestanden aanpast al 'meer dan één bewerkingsstap' voor beads, of tellen alleen afzonderlijke wijzigingsrondes?
A: Eén samenhangende wijziging telt als één stap, ook in twee bestanden

Q: Wil je de ontbrekende bron→besluit→bead→code/test-links in je twee bestaande projecten later ook achteraf aanvullen?
A: Ja, volledig historisch terugvullen

Q: Wat betekent 'volledig historisch' voor de twee bestaande projecten: ieder Git-commit inclusief kleine fixes, of alle betekenisvolle specs/besluiten/taken inclusief de relevante commits?
A: Alle betekenisvolle specs, besluiten en taken met relevante commits

Q: Als voor oud werk een bron of testbewijs ontbreekt, mag een terugwerkende bead met expliciet 'gereconstrueerd, bewijs onbekend' de lacune zichtbaar maken?
A: Ja, als retrospectief gemarkeerd; nooit als oorspronkelijk issue

Q: Heb je bij het mislukte interview letterlijk de melding ‘Project root does not match configured project’ gezien, of is de root-mismatch nu een codehypothese?
A: Letterlijke melding gezien
