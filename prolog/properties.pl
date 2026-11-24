:- module(properties, [property_constraints/2]).
:- use_module(library(apply)).
:- use_module(library(http/json)).
:- use_module(library(lists)).
:- use_module(library(pcre)).

property_constraints(Q, Hits) :-
    ( get_dict(allowConstraints, Q, true), get_dict(properties, Q, Labels) ->
        findall(Hit, (member(Label, Labels), property_hit(Q.text, Label, Hit)), Hits)
    ; Hits = [] ).

property_hit(Text, [Start, KeyEnd, Property],
             [Start, End, ["constraint", "*", Family, Body, 0], 0]) :-
    Family = Property.family,
    property_outside_quotes(Text, Start),
    KeyLength is KeyEnd - Start,
    sub_string(Text, Start, KeyLength, _, KeyWords),
    sub_string(Text, KeyEnd, _, 0, Suffix),
    property_value(Property.kind, Suffix, Consumed, Value, Words),
    End is KeyEnd + Consumed,
    maplist(property_quote, [Property.attribute, Value, KeyWords], [Attribute, Encoded, KeyEvidence]),
    ( Words == Value -> Evidence = ""
    ; property_quote(Words, ValueEvidence), format(string(Evidence), ' words=~s', [ValueEvidence]) ),
    format(string(Body),
           'on=attribute attribute=~s value=~s operator=eq phase=result key_words=~s~s',
           [Attribute, Encoded, KeyEvidence, Evidence]).

property_value("number", Suffix, Consumed, Value, Value) :-
    property_prefix(Suffix, Start, Tail),
    re_matchsub("^(?<value>[+-]?[0-9]+(?:\\.[0-9]+)?)(?=$|[ \\t;!?\\])}]|[,.](?:[ \\t]|$))",
                Tail, Groups, []),
    Value = Groups.value,
    string_length(Value, Length),
    Consumed is Start + Length.
property_value("quoted", Suffix, Consumed, Value, Words) :-
    property_prefix(Suffix, Start, Tail),
    ( re_matchsub("^(?<value>\"(?:[^\"\\\\\\r\\n]|\\\\.)+\")(?=$|[ \\t;!?.,\\])}])", Tail, Groups, []) ->
        Words = Groups.value,
        atom_string(Json, Words),
        catch(atom_json_term(Json, Value, [value_string_as(string)]), _, fail)
    ; re_matchsub("^(?<whole>“(?<value>[^”\\r\\n]+)”)(?=$|[ \\t;!?.,\\])}])", Tail, Groups, []),
      Words = Groups.whole, Value = Groups.value
    ),
    string_length(Words, Length),
    Consumed is Start + Length.

property_outside_quotes(Text, Start) :-
    sub_string(Text, 0, Start, _, Prefix),
    re_match("^(?:[^\"“”]|\"(?:[^\"\\\\\\r\\n]|\\\\.)*\"|“[^”\\r\\n]*”)*$", Prefix).

% The separator may be whitespace, a colon, or an equals sign on the same line.
property_prefix(Suffix, Length, Tail) :-
    re_matchsub("^(?<separator>[ \\t]*[:=][ \\t]*|[ \\t]+)", Suffix, Groups, []),
    string_length(Groups.separator, Length),
    sub_string(Suffix, Length, _, 0, Tail).

property_quote(Value, Encoded) :-
    atom_json_term(Encoded, Value, [as(string)]).
