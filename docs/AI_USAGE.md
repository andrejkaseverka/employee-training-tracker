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
- Revize našla dva problémy v ošetření chyb, ale AI je navrhla nechat neopravené („k vědomí“).
  Nesouhlasila jsem, protože oba uživatele nechají bez pomoci:
  1. Když spadl výpočet výsledků, zmizela celá stránka (bílá obrazovka) a nešlo ani nahrát
     jiné soubory. Teď se chybová zpráva ukáže jen v části s výsledky a nahrávání funguje dál.
  2. Při jakékoli chybě se zobrazilo „Soubory se nepodařilo načíst“, i když byla chyba
     v aplikaci, ne v souborech. Teď hláška rozliší „soubory nelze přečíst“ a „chyba aplikace,
     soubory jsou nejspíš v pořádku“.

  Zároveň se do konzole prohlížeče zapisuje jen typ chyby, ne její text, protože text chyby
  může obsahovat hodnoty z nahraných dat.

**Péče o data a CI**
- Vite vkládá malé CSV do JavaScriptu jako base64, takže kontrola hledající v buildu text by
  data přehlédla a prošla. CSV se teď vydávají jako samostatné soubory a CI dovolí v buildu jen
  soubory bajtově shodné s demo fixturami. Je to pojistka proti omylu (commit jiného CSV, změna
  konfigurace). Hlavní ochranou je, že původní data v repozitáři vůbec nejsou.
- AI navrhla navíc kontrolu buildu proti hodnotám z původních dat. Odmítla jsem ji: nasazuje se
  jen build z CI, kde původní data vůbec nejsou, a kontrola by vyžadovala mít je u sebe.
- Návrh CodeRabbitu jsem nechala ověřit proti kódu: část byla zastaralá, oprávněnou část
  (inlinované CSV má kontrolu shodit) jsem přijala.
