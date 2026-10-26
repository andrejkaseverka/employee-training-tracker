# Záznam o použití AI

## Nástroje a na co

- **Claude Code** (CLI agent v editoru): rámcový plán a plány jednotlivých fází, profilace CSV
  (skript mimo repozitář, výstup jen souhrnné počty), implementace a testy, revize větví před
  mergem (`/review`) a revize vzhledu (`/design-review`).
- **CodeRabbit**: automatická revize pull requestů.

Data jsou podle zadání vygenerovaná, proto je AI nástroj směl číst (obsah jde do API poskytovatele).
U skutečných osobních údajů bych to nedovolila; AI by viděla jen schéma a syntetická data.

## Jak jsem s AI pracovala

AI navrhovala plán, pravidla a kód; o doménových pravidlech a předpokladech jsem rozhodovala já.
Výstupy jsem ověřovala třemi způsoby: testy (u opravy nejdřív test, který na staré verzi padá),
**rekonciliací** (výsledky aplikace na původních datech porovnané s nezávislou profilací, jen
souhrnná čísla) a revizí každé větve před mergem.

## Co bylo nutné opravit nebo zpochybnit

**Doménová pravidla v návrzích AI**
- Zaměstnancům bez útvaru AI ukládala jen školení „pro všechny“ a vynechala povinnosti podle
  pozice, které známe. Opraveno: vynechají se jen útvarové povinnosti, s příznakem „chybí útvar“.
- Zástupný „rok 1900“ chtěla AI řešit pevnou hodnotou; zvolila jsem obecné okno věrohodnosti
  (absolvování nejvýš 50 let zpět), které funguje i pro jiné výplně.
- Nastupující po datu exportu chtěla AI vyřadit; zahrnula jsem je s termíny až od nástupu
  (vstupní BOZP je pro ně nejdůležitější).
- Priorita přidělení: AI doporučila „prošlé první“; zvolila jsem „chybí první“ (nikdy neproškolení).

**Čísla a analýza**
- Rekonciliace odhalila čtyři chybná čísla z profilace AI (např. 8 místo 9 útvarů, započtená
  opakovaná hlavička jako záznam). První porovnání jmen dalo 2 856 „nesouladů“, protože AI
  nepoznala pořadí „Příjmení Jméno“; skutečně jich je 100.
- AI odhadla 13 školení, kde termín přijde až po konci platnosti; skutečně jich je 53, protože
  odhad nepočítal s tím, že kapacitu dřívějších termínů zaplní vyšší priorita. Prioritu jsem
  ponechala a mezery vedly k návrhu „vypsat další termíny“.

**Chyby v kódu, které testy nezachytily (našla je revize)**
- Volná místa se počítala podle `id_terminu`; dva termíny se stejným ID by sdílely kapacitu
  a doporučení by ji mohlo překročit. Opakované ID je teď duplicita a termín se nenabízí.
- Seznam „Co řešit“ řadil jinak, než říká zvolená priorita, a test toto chybné pořadí potvrzoval.
  Opraveno na sdílenou prioritu z domény, nový test na staré verzi padá. Závěrečná revize celého
  kódu našla stejnou chybu ještě v záložce Zaměstnanci; opraveno stejně.
- AI nechala jako „k vědomí“ dvě věci, které jsem nepřijala: chyba výpočtu shodila celou stránku
  a každá chyba se hlásila jako „soubory nelze načíst“. Teď je výpočet oddělený (nahrávání
  funguje dál), chyby dat a chyby aplikace se rozlišují a do konzole nejde text chyby
  (mohl by citovat data).

**Péče o data a CI**
- Při ověřování se ukázalo, že Vite vkládá malé CSV do JavaScriptu jako base64, takže prosté
  hledání textu v buildu by únik dat nenašlo. Build teď CSV vydává jako samostatné soubory
  a CI vyžaduje, aby každé CSV bylo bajtově shodné s demo fixturou.
- AI navrhla navíc kontrolu buildu proti hodnotám z původních dat. Odmítla jsem ji: nasazuje se
  jen build z CI, kde původní data vůbec nejsou, a kontrola by vyžadovala mít je u sebe.
- Návrh CodeRabbitu jsem nechala ověřit proti kódu: část byla zastaralá, oprávněnou část
  (inlinované CSV má kontrolu shodit) jsem přijala.
