:- module(coordinated_effects,[coordinated_effects/2]).
:- use_module(library(lists)).

coordinated_effects(Q,Proofs) :-
    ( get_dict(coordinatedEffects,Q,Packet) ->
      findall(Proof,(member(Frame,Packet.frames),
        parts(Frame,Packet,0,End,Family,Owner,Effects,[]),
        length(Packet.keys,End),Effects=[[_,_,K,_],[_,_,L,_]],K\==L,
        Proof=_{family:Family,owner:Owner,effects:Effects}),Raw),
      sort(Raw,Proofs)
    ; Proofs=[] ).

parts([],_,End,End,_,_,Tail,Tail).
parts([Role|More],P,At,End,F,O,Effects,Tail) :-
    ( is_list(Role) -> append(Prefix,Rest,P.keys),length(Prefix,At),append(Role,_,Rest),
      length(Role,N),Next is At+N,Effects=After
    ; member([At,Next,Role,Family,Key,Value],P.events),
      ( Role=="join" -> Effects=After
      ; F=Family,(Role=="owner" -> O=[At,Next],Effects=After
                 ; Effects=[[At,Next,Key,Value]|After]) ) ),
    parts(More,P,Next,End,F,O,After,Tail).
