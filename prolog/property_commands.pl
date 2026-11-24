:- module(property_commands, [property_commands/2]).
:- use_module(library(http/json)).

% A command joins the complete written body to a corroborated lead only when
% the family/act proof and token boundary agree on both sides.
property_commands(Q, Candidates) :-
    ( get_dict(propertyCommands, Q, P) ->
      findall(_{source:"property-command",sop:Sop},
        ( member([End,Kind,Verb],P.heads), property_body(P,End,Kind,Body),
          predicate_field(Verb,Field),
          format(string(Sop),'@r w.request.request act=change mood=do~s~n~s',[Field,Body]) ),
        Candidates)
    ; Candidates=[] ).

property_body(P,Start,Kind,Body) :- member([Start,Kind,Body],P.bodies).
property_body(P,Start,Kind,Body) :-
    member([Start,At,Kind,Effect],P.effects), member([At,Kind,Owner],P.owners),
    format(string(Body),'~s~n~s',[Owner,Effect]).

predicate_field("", "") :- !.
predicate_field(Verb, Field) :-
    atom_json_term(Quoted,Verb,[as(string)]), format(string(Field),' predicate=~s',[Quoted]).
