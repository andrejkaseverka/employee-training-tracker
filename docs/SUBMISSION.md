# Evidence školení – průvodní text

Aplikace: https://andrejkaseverka.github.io/employee-training-tracker/ ·
Repozitář: https://github.com/andrejkaseverka/employee-training-tracker ·
Záznam o použití AI:
[docs/AI_USAGE.md](https://github.com/andrejkaseverka/employee-training-tracker/blob/main/docs/AI_USAGE.md)

## Co jsem postavila a proč tak

Do aplikace se nahrají čtyři CSV exporty (nebo ukázková data jedním tlačítkem). Ukazuje stav
povinných školení každého zaměstnance k 1. 10. 2026 (platné / brzy vyprší / prošlé / chybí /
nelze určit), seznam „Co řešit“ od nejnaléhavějšího, doporučení, koho přihlásit na který termín
bez překročení kapacity (i s důvodem, proč někoho zařadit nelze), a kvalitu dat.

- **Statická aplikace bez backendu** (React + TypeScript strict + Vite + Tailwind, GitHub Pages).
  Exporty jsou malé a jen ke čtení; server a databáze by nic nepřinesly a přidaly by provozní
  riziko. CSV se zpracují v prohlížeči a nikam se neodesílají.
- **Vrstvy domain → use-cases → UI.** Pravidla platnosti, povinností a přidělování jsou čisté
  funkce bez Reactu, „dnes“ je parametr; 195 testů (Vitest), hlavně platnost a přidělení.
- **CI:** typy, lint, testy, build a kontrola, že build obsahuje jen syntetická demo data.
  Původní CSV nejsou v repozitáři ani v buildu.

## Co jsem zjistila o datech a jaké předpoklady jsem udělala

Každý soubor má jiný „dialekt“: tři kódování (UTF-8, UTF-8 s BOM, Windows-1250), dva oddělovače,
víceřádková pole, opakovaná hlavička. Kódy školení mají 31 zápisů pro 10 kódů, útvary 17 zápisů
pro 9 útvarů. Dále duplicity, odkazy na neexistující zaměstnance, data ve třech formátech včetně
čísla z Excelu, zástupný rok 1900, absolvování v budoucnosti, 25 záznamů s `platnost_do` jinou
než v katalogu, neexistující datum termínu, přeplněné termíny a hodnoty typu `=HYPERLINK(…)`.
Rodné číslo úloha nepotřebuje, proto se nenačítá. Opravuje se jen to, co jde jednoznačně (zápis
kódu, útvaru, data); nejisté se nehádá, ale ukáže v kvalitě dat.

Předpoklady: „brzy vyprší“ = 60 dní (přepínatelné 30/60/90). Platnost se bere ze záznamu,
z katalogu se dopočítá, jen když chybí nebo nedává smysl. Ukončení se nepočítají, rodičovská je
v přehledu, ale nepřihlašuje se, nastupující jen na termíny od nástupu. Priorita přidělení:
chybí → prošlé → brzy vyprší, každý dostane nejbližší volný termín. `obsazeno` u termínu chápu
jako místa jiných lidí; data neříkají, zda tam už nejsou přihlášení naši zaměstnanci.

Na původních datech: 162 lidí, platné 610 / brzy vyprší 86 / prošlé 32 / chybí 66; přiděleno
178 ze 184 potřeb (zbylých 6 je na rodičovské). U 53 z 82 školení, která brzy vyprší, je termín
až po konci platnosti, ve 39 případech proto, že dřívější termíny zaplní lidé s vyšší prioritou.

## Co jsem nestihla nebo vědomě vynechala

- **Optimalizace přidělení** (přesouvání lidí kvůli lepšímu využití kapacity): přidělení je
  deterministické a vysvětlitelné. Co je „lepší“, záleží na organizaci (lze vypsat další termín?
  vadí volná místa na interním školení?).
- **Úpravy dat v aplikaci:** nejasné záznamy (konfliktní duplicity, odchylky od katalogu,
  chybějící útvar) se jen hlásí.
- Stav „už přihlášen“, volba referenčního data v UI, e2e test (aplikace ověřena ručně
  v prohlížeči) a vzhled, který zadání nehodnotí.

## Co bych dělala dál

1. **Návrh nových termínů:** u kterého interního školení nabídka nestačí, do kdy je termín
   potřeba a pro kolik lidí (data už doporučení má).
2. **Pravidla podle organizace:** práh „brzy vyprší“ podle školení (přihlášky s předstihem),
   pravidla přeskládání a vypisování termínů.
3. **Správa dat v aplikaci místo exportů:** databáze, přihlášení a role (HR, vedoucí vidí své
   lidi), audit; nesrovnalosti vyřešit jednou při importu, pak editovat zaměstnance, absolvování
   a přihlášky v aplikaci, nebo se napojit na zdrojové systémy.
4. **E2E test v CI** a UI srozumitelné pro běžné uživatele.
