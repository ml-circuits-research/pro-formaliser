:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(library(http/json)).
:- use_module(library(readutil)).
:- use_module(library(pcre)).
:- initialization(main, main).

main :- repeat,
    read_line_to_string(user_input, Line),
    ( Line == end_of_file -> !
    ; catch((atom_json_dict(Line, Q, []), answer(Q, Answers),
             json_write_dict(current_output, Answers, [width(0)])),
            E, (print_message(error, E), halt(1))),
      nl, flush_output, fail ).

answer(Q, Answers) :-
    findall(S-C, candidate(Q, S, C), Pairs),
    keysort(Pairs, Ascending), reverse(Ascending, Ordered),
    unique_sops(Ordered, [], 12, Answers).

unique_sops([], _, _, []).
unique_sops([_|_], _, 0, []) :- !.
unique_sops([_-C|Rest], Seen, N, Answers) :-
    ( memberchk(C.sop, Seen) -> unique_sops(Rest, Seen, N, Answers)
    ; Answers = [C|Tail], Next is N-1, unique_sops(Rest, [C.sop|Seen], Next, Tail) ).

candidate(Q, score(3, N, 0), _{sop:Sop, source:example, support:N}) :-
    member(E, Q.examples), Sop = E.sop, N = E.count.
candidate(Q, score(2, Specificity, N), _{sop:Sop, source:template, support:N}) :-
    member(T, Q.templates), matches(T.pattern, Q.tokens, Q.text, [], Bindings),
    maplist(part(Bindings), T.parts, Parts), atomics_to_string(Parts, Sop),
    include(string, T.pattern, Anchors), length(Anchors, Specificity), N = T.count.
candidate(Q, score(1, Score, 0), _{sop:Sop, source:lexicon, support:N}) :-
    member([Start,End,["act",Act,Mood,N],ActPrior], Q.hits),
    span(Q.text, Start, End, Predicate), encode(Act, A), encode(Predicate, P),
    ( Mood == "" -> M = "" ; format(string(M), ' mood=~s', [Mood]) ),
    format(string(Req), '@r1 w.request.request act=~s~s predicate=~s', [A,M,P]),
    ( member([S,E,["target",Act,Family,Mode,Sort,K],FamilyPrior], Q.hits),
      ( S >= End ; E =< Start ),
      span(Q.text, S, E, Surface), target(Family, Mode, Sort, Surface, T),
      constraint_wires(Q, Act, Family, Mode, Start-End, S-E, More, Covered),
      append([Start-End,S-E], Covered, Bounds), Wires = [Req,T|More],
      length(More, Evidence), Extra is 5 + Evidence + FamilyPrior + log(1+K)/2 + min(4,E-S)/2
    ; Bounds = [Start-End], Wires = [Req], Extra = 0 ),
    sort(Bounds, Sorted), string_length(Q.text, Length),
    residuals(Sorted, Q.text, 0, Length, 1, Unread),
    append(Wires, Unread, All), atomics_to_string(All, "\n", Sop),
    Score is Extra + ActPrior + log(1+N) + min(12,End-Start)/4 - Start/3.

constraint_wires(Q, Act, Family, Mode, PS-PE, TS-TE, Wires, Bounds) :-
    ( Q.allowConstraints == true ->
      findall(priority(Len,N)-hit(S,E,Body),
              ( member([S,E,["constraint",Act,Family,Body,N],_], Q.hits),
                (S >= PE ; E =< PS), (S >= TE ; E =< TS),
                (Mode == "new" ; S >= TE),
                Len is E-S ), Records),
      sort(Records, Sorted), reverse(Sorted, Ranked),
      choose_constraints(Ranked, [], Selected), sort(Selected, Chronological),
      numbered_constraints(Chronological, 1, Wires, Bounds)
    ; Wires=[], Bounds=[] ).

choose_constraints([], Acc, Acc).
choose_constraints([_-hit(S,E,Body)|Rest], Acc, Out) :-
    ( member(hit(A,B,_),Acc), S < B, E > A -> Next=Acc
    ; Next=[hit(S,E,Body)|Acc] ),
    choose_constraints(Rest,Next,Out).

numbered_constraints([], _, [], []).
numbered_constraints([hit(S,E,Body)|Rest], N, [Line|Lines], [S-E|Spans]) :-
    format(string(Line),'@r1.c~d w.request.constraint request=$r1 ~s',[N,Body]),
    Next is N+1, numbered_constraints(Rest,Next,Lines,Spans).

target(Family, Mode, Sort, Surface, Wire) :-
    encode(Family, F), encode(Surface, S),
    ( Sort == "" -> format(string(T), 'family_words=~s', [S])
    ; encode(Sort, Kind),
      ( Sort == Surface -> format(string(T), 'sort=~s', [Kind])
      ; format(string(T), 'sort=~s sort_words=~s', [Kind,S]) ) ),
    ( Sort == "", Mode \== "new" ->
      Lookup = "\n@r1.l1 w.request.lookup request=$r1 target=$r1.t key=thing from=page"
    ; Lookup = "" ),
    format(string(Wire), '@r1.t w.request.target request=$r1 family=~s mode=~s ~s~s', [F,Mode,T,Lookup]).

span(Text, Start, End, Value) :- Length is End-Start, sub_string(Text, Start, Length, _, Value).
residuals([], Text, Start, End, N, Lines) :- unread(Text,Start,End,N,Lines).
residuals([S-E|Tail], Text, From, End, N, Lines) :-
    unread(Text,From,S,N,Here), length(Here,K), Next is N+K,
    residuals(Tail,Text,E,End,Next,Rest), append(Here,Rest,Lines).
unread(Text,S,E,N,Lines) :-
    span(Text,S,E,Raw), re_replace("^\\s+|\\s+$"/g, "", Raw, Trim),
    ( re_match("[\\p{L}\\p{N}]", Trim) ->
      encode(Trim,V), format(string(Line),'@r1.u~d w.request.unread request=$r1 text=~s',[N,V]), Lines=[Line]
    ; Lines=[] ).

matches([], [], _, Bindings, Bindings).
matches([P|Ps], [Tok|Ts], Text, Bound, Result) :-
    string(P), !, Tok = [P,_,_,_], matches(Ps, Ts, Text, Bound, Result).
matches([P|Ps], Ts, Text, Bound, Result) :-
    is_dict(P), between(P.min,P.max,N), N > 0,
    length(Take,N), append(Take,Rest,Ts),
    Take = [[_,_,Start,_]|_], last(Take,[_,_,_,End]), span(Text,Start,End,Value),
    ( get_dict(kind,P,"number") -> re_match("^[+-]?[0-9]+(?:\\.[0-9]+)?$", Value) ; true ),
    ( memberchk(P.slot-Existing,Bound) -> Existing == Value, Next = Bound
    ; Next = [P.slot-Value|Bound] ),
    matches(Ps, Rest, Text, Next, Result).

part(_, Literal, Literal) :- string(Literal), !.
part(Bound, Part, Value) :-
    memberchk(Part.slot-Raw, Bound), encoded(Part.quote, Raw, Value).

encoded("always", Raw, Value) :- json_string(Raw, Value).
encoded("escape", Raw, Value) :- json_string(Raw, Quoted), sub_string(Quoted,1,_,1,Value).
encoded("never", Raw, Raw) :- (safe_atom(Raw) -> true ; re_match("^[+-][0-9]+(?:\\.[0-9]+)?$", Raw)).
encoded("auto", Raw, Value) :- encode(Raw, Value).
safe_atom(Raw) :- re_match("^[\\p{L}\\p{N}_][\\p{L}\\p{N}_.-]*$",Raw).
encode(Raw,Value) :- ( safe_atom(Raw) -> Value=Raw ; json_string(Raw,Value) ).
json_string(Raw,Value) :- atom_json_term(Value, Raw, [as(string)]).
