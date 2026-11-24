:- module(argument_sequences,[argument_sequences/2]).
:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(library(solution_sequences)).

argument_sequences(Q,Proofs) :-
    ( get_dict(argumentSequences,Q,Frames) ->
      findall(Proof,
        (member(F,Frames), once(findnsols(2,B,distinct(B,sequence(F.parts,F.input,B)),Answers)),Answers=[Slots],
         predicate_binding(F,Slots,Bindings,Owned),
         Base=_{family:F.family,act:F.act,mode:F.mode,anchor:F.anchor,start:F.start,end:F.end,bindings:Bindings},
         ( nonvar(Owned) -> put_dict(owned,Base,Owned,Proof) ; Proof=Base )), Proofs)
    ; Proofs=[] ).

predicate_binding(F,Slots,Bindings,Owned) :-
    ( get_dict(owned,F,Frame) ->
      ( get_dict(bindsPredicate,Frame,true) ->
        select(["$predicate",_,Start,End],Slots,Bindings),
        put_dict(_{predicateStart:Start,predicateEnd:End},Frame,Owned)
      ; Bindings=Slots, Owned=Frame )
    ; Bindings=Slots ).

sequence([],[],[]).
sequence([Part|Tail],Tokens,Bindings) :-
    ( get_dict(literal,Part,Words) -> eat(Words,Tokens,Rest), Bs=Bindings
    ; Tokens=[[_,Start,_,_]|_],
      slot(Part,Tokens,Rest,Canonical),
      append(Consumed,Rest,Tokens),last(Consumed,[_,_,End,_]),
      Bindings=[[Part.key,Canonical,Start,End]|Bs] ),
    sequence(Tail,Rest,Bs).

slot(Part,Tokens,Rest,Canonical) :-
    ( get_dict(bank,Part,Bank) ->
      member([Words,Canonical],Bank), eat(Words,Tokens,Rest)
    ; get_dict(nominal,Part,Nominals) ->
      Canonical="", between(0,8,N), length(Description,N), append(Description,After,Tokens),
      maplist(open_token,Description), member(Noun,Nominals), eat(Noun,After,Rest)
    ; Canonical="", between(1,12,N), length(Taken,N),append(Taken,Rest,Tokens),
      maplist(open_token,Taken) ).

eat([],Ts,Ts).
eat([K|Ks],[[K,_,_,_]|Ts],Rest) :- eat(Ks,Ts,Rest).
open_token([_,_,_,true]).
