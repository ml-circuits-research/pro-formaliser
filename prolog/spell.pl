:- module(spell, [main/0]).
:- use_module(library(http/json)).
:- use_module(library(readutil)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- dynamic known/1, candidate/1.

main :-
    set_stream(user_input, encoding(utf8)),
    set_stream(user_output, encoding(utf8)),
    current_prolog_flag(argv, [Dictionary]),
    json_read_dict(user_input, Request),
    setup_call_cleanup(
        open(Dictionary, read, Stream, [encoding(utf8)]),
        load_dictionary(Stream),
        close(Stream)
    ),
    maplist(load_extra, Request.knownWords),
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
    assertz(known(Atom)),
    assertz(candidate(Atom)).

suggestions(Word, Matches) :-
    atom_string(Atom, Word),
    (   known(Atom)
    ->  Matches = []
    ;   atom_codes(Atom, Codes),
        findall(Score-Match, one_edit_match(Codes, Score, Match), Candidates),
        sort(Candidates, Ranked),
        maplist(scored_word, Ranked, Matches)
    ).

scored_word(Score-Word, _{score: Score, word: Word}).

one_edit_match(Codes, Score, Match) :-
    one_edit(Codes, Edited, Score),
    atom_codes(Match, Edited),
    candidate(Match).

ascii_letter(Code) :-
    between(0'a, 0'z, Code).

% Adjacent swaps and doubled-letter edits take precedence over other edits.
one_edit(Codes, Edited, Score) :-
    append(Left, [Letter|Right], Codes),
    append(Left, Right, Edited),
    repetition_score(Left, Letter, Right, Score).
one_edit(Codes, Edited, Score) :-
    append(Left, Right, Codes),
    ascii_letter(Letter),
    append(Left, [Letter|Right], Edited),
    repetition_score(Left, Letter, Right, Score).
one_edit(Codes, Edited, 2) :-
    append(Left, [Old|Right], Codes),
    ascii_letter(Letter),
    Letter =\= Old,
    append(Left, [Letter|Right], Edited).
one_edit(Codes, Edited, 1) :-
    append(Left, [First,Second|Right], Codes),
    First =\= Second,
    append(Left, [Second,First|Right], Edited).

repetition_score(Left, Letter, Right, Score) :-
    (   Right = [Letter|_]
    ;   last(Left, Letter)
    ),
    !,
    Score = 1.
repetition_score(_, _, _, 2).

:- initialization(main, main).
