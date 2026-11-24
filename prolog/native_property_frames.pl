:- module(native_property_frames,[native_property_frames/2]).
:- use_module(library(lists)).
:- use_module(library(solution_sequences)).

native_property_frames(Q,Proofs) :-
    ( get_dict(nativeProperties,Q,Packet), is_dict(Packet) ->
      findnsols(97,Proof,distinct(Proof,property_frame(Packet,Proof)),Found),
      ( length(Found,N), N=<96 -> Proofs=Found ; Proofs=[] )
    ; Proofs=[] ).

property_frame(Packet,Proof) :-
    member(Frame,Packet.frames),
    length(Packet.words,End),
    walk(Frame.pattern,Packet,0,End,Family,Key,Roles),
    memberchk("thing"-Owner,Roles), memberchk("attribute"-Attribute,Roles),
    memberchk("value"-Value,Roles), memberchk("predicate"-Predicate,Roles),
    ( Frame.numberOnly == false ; Value.numeric == true ),
    ( Packet.question == false ; memberchk("lead"-_,Roles) ),
    get_dict(family,Owner,Family), get_dict(key,Attribute,Key),
    Proof=_{act:Frame.act,frame:Frame.name,owner:Owner,attribute:Attribute,value:Value,predicate:Predicate}.

walk([],_,End,End,_,_,[]).
walk([Part|Rest],Packet,At,End,Family,Key,Roles) :-
    ( get_dict(role,Part,Role) ->
      event(Role,Packet,At,Family,Key,Event), Next=Event.b, Roles=[Role-Event|Tail]
    ; Part.optional == true, Next=At, Roles=Tail
    ; member(Words,Part.forms), eat(Words,Packet.words,At,Next),
      ( get_dict(mark,Part,Mark) -> Roles=[Mark-[At,Next]|Tail] ; Roles=Tail ) ),
    walk(Rest,Packet,Next,End,Family,Key,Tail).

event("thing",Packet,At,Family,_,Event) :-
    member(Event,Packet.owners), Event.a=:=At, Family=Event.family.
event("attribute",Packet,At,Family,Key,Event) :-
    member(Event,Packet.attrs), Event.a=:=At, Family=Event.family, Key=Event.key.
event("value",Packet,At,Family,Key,Event) :-
    member(Event,Packet.values), Event.a=:=At, Family=Event.family, Key=Event.key.

eat([],_,At,At).
eat([Word|Rest],Input,At,End) :-
    nth0(At,Input,Word), Next is At+1, eat(Rest,Input,Next,End).
