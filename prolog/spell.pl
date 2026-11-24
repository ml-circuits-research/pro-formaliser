:- module(spell, [main/0]).
:- use_module(library(http/json)).
:- use_module(library(readutil)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- dynamic known/1, candidate/1, frequency/2.

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
    maplist(suggestions, Request.words, Suggestions),
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
    (known(Atom) -> true ; assertz(known(Atom))),
    (candidate(Atom) -> true ; assertz(candidate(Atom))).

load_frequencies(Stream) :-
    read_line_to_string(Stream, Line),
    (   Line == end_of_file
    ->  true
    ;   split_string(Line, " ", "", [Word, Count]),
        atom_string(Atom, Word),
        (   candidate(Atom)
        ->  number_string(Frequency, Count),
            assertz(frequency(Atom, Frequency))
        ;   true
        ),
        load_frequencies(Stream)
    ).

suggestions(Word, Matches) :-
    atom_string(Atom, Word),
    (   known(Atom)
    ->  Matches = []
    ;   atom_codes(Atom, Codes),
        findall(Key-Match, one_edit_match(Codes, Key, Match), Candidates),
        sort(Candidates, Ranked),
        maplist(scored_word, Ranked, Matches)
    ).

scored_word(Key-Word, _{score: Score, word: Word}) :-
    Score is -Key.

one_edit_match(Codes, Key, Match) :-
    one_edit(Codes, Edited, EditWeight),
    atom_codes(Match, Edited),
    candidate(Match),
    (frequency(Match, Count) -> true ; Count = 0),
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
