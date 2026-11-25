:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(library(pairs)).
:- use_module(library(readutil)).
:- use_module(library(http/json)).
:- initialization(main, main).

main :-
    repeat, read_line_to_string(user_input, Line),
    ( Line == end_of_file -> !
    ; atom_json_dict(Line, Q, []), estimate(Q, Result),
      json_write_dict(current_output, Result, [width(0)]), nl, flush_output, fail ).

% Instance identity and accepted recent discourse supply evidence using only
% values supplied to the standalone estimator.
estimate(Q, Result) :-
    findall(Key-Row,
        ( member(C,Q.candidates), evidence(Q.context,C,Reasons),
          findall(W,(member(R,Reasons),W=R.weight),Weights), sum_list(Weights,ContextScore),
          Prior is 1/(1+C.index), Score is Prior+ContextScore,
          Key = sort(Score,Prior),
          Base = _{index:C.index,score:Score,contextScore:ContextScore,reasons:Reasons},
          ( get_dict(textEvidence,C,Proof) -> Row=Base.put(textEvidence,Proof) ; Row=Base ) ),
        Scored),
    keysort(Scored,Asc), reverse(Asc,Desc), pairs_rows(Desc,ContextRanking),
    text_ranking(ContextRanking,Ranked), maybe_rank_relations(Ranked,Relations),
    maplist(drop_text_packet,Relations,Ranking),
    decision(Ranking,Decision,Index),
    Result = _{selectedIndex:Index,decision:Decision,ranking:Ranking}.

pairs_rows([],[]).
pairs_rows([_-X|Xs],[X|Rs]) :- pairs_rows(Xs,Rs).
drop_text_packet(Row,Public) :- (del_dict(textEvidence,Row,_,Public) -> true ; Public=Row).

% Promote only over a peer with the same grounded body. Use the peer's
% position so unrelated interpretations keep their contextual rank.
maybe_rank_relations(Ranking,Ranked) :-
    ( member(Row,Ranking), get_dict(textEvidence,Row,Proof), get_dict(relationPeers,Proof,_) ->
        relation_ranking(Ranking,Ranked)
    ; Ranked=Ranking ).

relation_ranking([],[]).
relation_ranking([Row|Rest],[Promoted|Ranked]) :-
    ( append(Before,[Extension|After],Rest),
      get_dict(textEvidence,Extension,Proof),
      get_dict(relationPeers,Proof,Peers), memberchk(Row.index,Peers),
      Extension.contextScore >= Row.contextScore ->
        append(Before,[Row|After],Next),
        append(Extension.reasons,[_{signal:"grounded_relation_extension",peer:Row.index,weight:0}],Reasons),
        Promoted=Extension.put(reasons,Reasons)
    ; Promoted=Row, Next=Rest ),
    relation_ranking(Next,Ranked).

% Text compares only compatible act/owner interpretations, leaving their
% shared positions relative to other interpretations as ranked by context.
text_ranking(Ranking,Ranking) :-
    \+ (member(R,Ranking),get_dict(textEvidence,R,_)), !.
text_ranking(Ranking,Reordered) :-
    findall(Group-(Position-Row),
        ( nth0(Position,Ranking,Row),
          ( get_dict(textEvidence,Row,Proof) -> Group=lane(Proof.lane)
          ; Group=isolated(Position) ) ), Pairs),
    keysort(Pairs,Ordered), group_pairs_by_key(Ordered,Groups),
    maplist(text_group,Groups,RankedGroups),
    append(RankedGroups,Ranked), keysort(Ranked,ByPosition),
    pairs_rows(ByPosition,Reordered).

text_group(_-[Pair],[Pair]) :- !.
text_group(_-Pairs,Pairs) :-
    \+ (member(_-Row,Pairs), Proof=Row.textEvidence, Proof.asked+Proof.keyedEffects > 0), !.
text_group(_-Pairs,Refilled) :-
    pairs_keys(Pairs,Positions),
    findall(Key-Result,
        ( member(_-Row,Pairs), Proof=Row.textEvidence,
          Weight is Proof.quality*1.5,
          Score is Row.score+Weight,
          Key=sort(Score,Row.score),
          Reason=_{signal:"written_property_evidence",weight:Weight,asked:Proof.asked,
                   supportedEffects:Proof.groundedEffects,unsupportedEffects:Proof.unsupportedEffects,
                   unread:Proof.unread},
          append(Row.reasons,[Reason],Reasons),
          Result=Row.put(_{textScore:Weight,reasons:Reasons}) ), Scores),
    keysort(Scores,Asc), reverse(Asc,Desc), pairs_rows(Desc,Rows),
    pairs_keys_values(Refilled,Positions,Rows).

decision([],"unresolved",null).
decision([R],"single_candidate",R.index).
decision([R,S|Rest],Decision,R.index) :-
    ( member(Other,[S|Rest]), Other.contextScore >= R.contextScore -> Decision = "underdetermined"
    ; Decision = "context_favors" ).

evidence(Context,C,Reasons) :-
    best_signal(entity_evidence(Context.entities,C),Entity),
    best_signal(history_evidence(Context.turns,C),History),
    append(Entity,History,Reasons).

% A long circuit, duplicated entity or repeated historical mention should
% not win just because it repeats the same signal.
best_signal(Goal,Result) :-
    findall(W-R,(call(Goal,R),W=R.weight),Pairs),
    ( Pairs=[] -> Result=[] ; keysort(Pairs,Sorted), last(Sorted,_-Best), Result=[Best] ).

same(A,B) :- A \== "", B \== "", A == B.
identity(T,E) :- member(Name,T.names), (same(Name,E.name);same(Name,E.id)), !.
compatible(T,E) :- same(T.family,E.family), (T.sort == ""; E.sort == ""; T.sort == E.sort).
can_refer(T) :- T.mode \== "new".

entity_evidence(Entities,C,R) :-
    member(T,C.targets), can_refer(T), member(E,Entities), compatible(T,E),
    ( identity(T,E) -> Base=7, Signal="entity_identity"
    ; T.names=[], E.selected==true -> Base=5, Signal="selected_entity"
    ; T.names=[], same(T.sort,E.sort) -> Base=2, Signal="entity_sort"
    ; T.names=[], selector_fit(T,E,Fit0), Fit0 > 0, Base=0, Signal="entity_property" ),
    ( E.selected==true -> Focus=1 ; Focus=0 ),
    selector_fit(T,E,Fit), W is Base+Focus+Fit,
    R=_{signal:Signal,entity:E.id,family:E.family,selectorFit:Fit,weight:W}.

% Score only explicit equality selectors on properties supplied by the caller.
% Result properties describe the requested change and cannot identify its target.
selector_fit(T,E,Fit) :-
    findall(V,(member(S,T.selectors),
               findall(Value,(member(P,E.properties),P.key == S.key,Value=P.value),Values), Values \== [],
               (memberchk(S.value,Values) -> V=1 ; V= -1)), Votes),
    sum_list(Votes,Total), Fit is max(-3,min(3,3*Total)).

history_evidence(Turns,C,R) :-
    member(T,C.targets), member(H,Turns), member(M,H.mentions),
    same(T.family,M.family),
    ( can_refer(T), member(N,T.names), memberchk(N,M.names) -> Base=6, Signal="previous_identity"
    ; can_refer(T), T.names=[], same(T.sort,M.sort) -> Base=3, Signal="previous_sort"
    ; Base=1, Signal="previous_family" ),
    W is Base/(1+0.6*H.age),
    R=_{signal:Signal,turn:H.index,family:M.family,weight:W}.
history_evidence(Turns,C,R) :-
    member(H,Turns), member(F,H.cues), memberchk(F,C.families),
    W is 0.7/(1+0.6*H.age),
    R=_{signal:"discussion_vocabulary",turn:H.index,family:F,weight:W}.
history_evidence(Turns,C,R) :-
    member(H,Turns), member(T,C.targets), can_refer(T), member(Label,T.labels), Label \== [],
    append(_,Rest,H.words), append(Label,_,Rest),
    W is 2/(1+0.6*H.age),
    R=_{signal:"discussion_name",turn:H.index,words:Label,weight:W}.
