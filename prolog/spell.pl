:- module(spell, [main/0]).
:- use_module(library(http/json)).
:- use_module(library(readutil)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- dynamic known/1, candidate/1, extra/1, frequency/2.

main :-
    set_stream(user_input, encoding(utf8)),
    set_stream(user_output, encoding(utf8)),
    current_prolog_flag(argv, [Dictionary, Frequencies]),
    json_read_dict(user_input, Request),
    setup_call_cleanup(
        open(Dictionary, read, Stream, [encoding(utf8)]),
        load_dictionary(Stream),
        close(Stream)
    ),
    maplist(load_extra, Request.knownWords),
    setup_call_cleanup(
        open(Frequencies, read, FrequencyStream, [encoding(utf8)]),
        load_frequencies(FrequencyStream),
        close(FrequencyStream)
    ),
    maplist(suggestions(Request.contextual), Request.words, Suggestions),
    json_write_dict(user_output, Suggestions).

load_dictionary(Stream) :-
    read_line_to_string(Stream, Word),
    (   Word == end_of_file
    ->  true
    ;   downcase_atom(Word, Lower),
        assertz(known(Lower)),
        (atom_string(Lower, Word) -> assertz(candidate(Lower)) ; true),
        load_dictionary(Stream)
    ).

load_extra(Word) :-
    atom_string(Atom, Word),
    (known(Atom) -> true ; assertz(extra(Atom))),
    (candidate(Atom) -> true ; assertz(candidate(Atom))).

load_frequencies(Stream) :-
    read_line_to_string(Stream, Line),
    (   Line == end_of_file
    ->  true
    ;   split_string(Line, " ", "", [Word, Count]),
        atom_string(Atom, Word),
        number_string(Frequency, Count),
        assertz(frequency(Atom, Frequency)),
        load_frequencies(Stream)
    ).

suggestions(_, Word, _{known: true, count: 0, matches: []}) :-
    atom_string(Atom, Word),
    extra(Atom),
    !.
suggestions(Contextual, Word, _{known: Known, count: Count, matches: Matches, splits: Splits}) :-
    atom_string(Atom, Word),
    (known(Atom) -> Known = true ; Known = false),
    word_count(Atom, Count),
    (   Known == false
    ;   Contextual == true
    ),
    !,
    atom_codes(Atom, Codes),
    findall(Key-Match, one_edit_match(Codes, Key, Match), Candidates),
    sort(Candidates, Ranked),
    maplist(scored_word, Ranked, Matches),
    ( Known == false, Contextual == true, Count == 0 ->
        findall([Left,Right], (append([A,B|Ls],[C,D|Rs], Codes),
                 atom_codes(Left,[A,B|Ls]), atom_codes(Right,[C,D|Rs]),
                 candidate(Left), candidate(Right)), Splits)
    ; Splits=[] ).
suggestions(_, _, _{known: true, count: 0, matches: []}).

word_count(Word, Count) :-
    (frequency(Word, Count) -> true ; Count = 0).

scored_word(Key-data(Word, Weight), _{score: Score, word: Word, weight: Weight}) :-
    Score is -Key.

one_edit_match(Codes, Key, data(Match, EditWeight)) :-
    one_edit(Codes, Edited, EditWeight),
    atom_codes(Match, Edited),
    candidate(Match),
    word_count(Match, Count),
    Key is -(Count + 1) * EditWeight.

ascii_letter(Code) :-
    between(0'a, 0'z, Code).

% Adjacent swaps and doubled-letter edits have a higher prior than arbitrary edits.
one_edit(Codes, Edited, Score) :-
    append(Left, [Letter|Right], Codes),
    append(Left, Right, Edited),
    repetition_score(Left, Letter, Right, Score).
one_edit(Codes, Edited, Score) :-
    append(Left, Right, Codes),
    ascii_letter(Letter),
    append(Left, [Letter|Right], Edited),
    repetition_score(Left, Letter, Right, Score).
one_edit(Codes, Edited, 1) :-
    append(Left, [Old|Right], Codes),
    ascii_letter(Letter),
    Letter =\= Old,
    append(Left, [Letter|Right], Edited).
one_edit(Codes, Edited, 4) :-
    append(Left, [First,Second|Right], Codes),
    First =\= Second,
    append(Left, [Second,First|Right], Edited).

repetition_score(Left, Letter, Right, Score) :-
    (   Right = [Letter|_]
    ;   last(Left, Letter)
    ),
    !,
    Score = 4.
repetition_score(_, _, _, 1).

:- initialization(main, main).
