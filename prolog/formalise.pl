:- use_module(library(lists)).
:- use_module(library(pairs)).
:- use_module(library(apply)).
:- use_module(library(http/json)).
:- use_module(library(readutil)).
:- use_module(library(pcre)).
:- use_module(properties).
:- use_module(native_property_frames).
:- use_module(property_commands).
:- use_module(topic_commands).
:- use_module(argument_sequences).
:- use_module(member_actions).
:- use_module(universal_inventory).
:- use_module(landmark_pairs).
:- use_module(set_exclusion).
:- use_module(verb_effects).
:- use_module(coordinated_effects).
:- use_module(roles).
:- use_module(language_frames).
:- initialization(main, main).

main :- repeat,
    read_line_to_string(user_input, Line),
    ( Line == end_of_file -> !
    ; catch((atom_json_dict(Line, Q, []), answer(Q, Answers),
             json_write_dict(current_output, Answers, [width(0)])),
            E, (print_message(error, E), halt(1))),
      nl, flush_output, fail ).

answer(Q, Plans) :- get_dict(landmarkPair,Q,Packet), !, landmark_pair_plans(Packet,Plans).
answer(Q, Plans) :- get_dict(setExclusion,Q,Packet), !, exclusion_plans(Packet,Plans).
answer(Q, Proofs) :- get_dict(languageOnly,Q,Packet), !, frame_proofs(Packet,Proofs).
answer(Q, _{candidates:Answers,frontedCandidates:Fronted,universalCandidates:Universal,proofs:Proofs,groundedPredicates:Grounded,topicCommands:Topics,sequences:Sequences,memberActions:Members,coordinatedEffects:Effects,verbEffects:VerbEffects,nativeProperties:NativeProperties}) :-
    topic_commands(Q,Topics),
    native_property_frames(Q,NativeProperties),
    verb_effects(Q,VerbEffects),
    coordinated_effects(Q,Effects),
    member_actions(Q,Members),
    argument_sequences(Q,Sequences),
    frame_proofs(Q.language,Proofs),
    findall([Start,End,Act],
            ( member(Proof,Proofs), offsets(Q.tokens,Proof.predicate,Start,End),
              Act=Proof.act, memberchk([Start,End,[Act],true], Q.declaredActs) ), Matches),
    sort(Matches,Grounded),
    property_constraints(Q, ExtraHits), append(Q.hits,ExtraHits,Hits),
    findall(B, (member(P,Proofs), target_scope(Q.tokens,Q.targetRoles,P,B)), RawBounds), sort(RawBounds, Bounds),
    reset_role_cache, index_roles(Q.put(_{roleScopes:Bounds,groundedPredicates:Grounded}), Hits, WithProperties),
    ( get_dict(frontedPlan, Q, Clause) ->
      findall(CleanFront,
              ( member(ActHit,WithProperties.actHits),
                ActHit=[Start,_,["act",Act,Mood,_],_], Start=:=Clause.predicate,
                memberchk(Mood,["","do","propose"]), memberchk(Act,Clause.acts),
                ScopedFront=WithProperties.put(_{actHits:[ActHit],frontedDestination:Clause}),
                lexical_candidate(ScopedFront,_,Front), sub_string(Front.sop,_,_,_," operator=relation "),
                clean_candidate(Front,CleanFront) ), Fronts),
      list_to_set(Fronts,Fronted)
    ; Fronted=[] ),
    universal_inventory_plans(WithProperties, Plans),
    findall(CleanUniversal,
            ( member(Plan, Plans), Target=Plan.targetHit,
              Scoped=WithProperties.put(_{actHits:[Plan.actHit],targetHits:[Target|WithProperties.targetHits],requiredTarget:Target}),
              lexical_candidate(Scoped, _, Candidate), clean_candidate(Candidate, CleanCandidate),
              CleanUniversal=CleanCandidate.put(requiresResult,Plan.requiresResult) ),
            RawUniversal),
    list_to_set(RawUniversal, Universal),
    findall(S-C, candidate(WithProperties, S, C), Pairs),
    keysort(Pairs, Ascending), reverse(Ascending, Ordered),
    unique_sops(Ordered, [], 12, Head),
    findall(Key-C, (member(_-C,Ordered),get_dict(binding,C,Key)), Tagged),
    keysort(Tagged, ByBinding), group_pairs_by_key(ByBinding, Groups),
    findall(C, member(_-[C|_],Groups), Reps),
    append(Head,Reps,Combined), maplist(clean_candidate,Combined,Clean),
    property_commands(Q, PropertyCommands), append(Clean,PropertyCommands,All), list_to_set(All, Answers).

clean_candidate(C, Clean) :- (del_dict(binding,C,_,Clean) -> true ; Clean=C).

% A separated object span can guide search before the bounded candidate list
% is formed. A one-argument frame spanning the entire tail adds no preference.
target_scope(Tokens,TargetRoles,Proof,[Act,PS,PE,Start,End]) :-
    Proof.roles=[_,_|_], member(R,Proof.roles), memberchk(R.role,TargetRoles),
    offsets(Tokens,Proof.predicate,PS,PE), offsets(Tokens,R.range,Start,End), Act=Proof.act.

offsets(Tokens,[First,After],Start,End) :-
    Last is After-1, nth0(First,Tokens,[_,_,Start,_]), nth0(Last,Tokens,[_,_,_,End]).

scope_fit(Scopes,Act,PS,PE,S,E,Bonus) :-
    ( member([Act,PS,PE,_,_],Scopes),
      \+ (member([Act,PS,PE,A,B],Scopes), (S<A ; E>B)) -> Bonus=2
    ; Bonus=0 ).

unique_sops([], _, _, []).
unique_sops([_|_], _, 0, []) :- !.
unique_sops([_-C|Rest], Seen, N, Answers) :-
    ( memberchk(C.sop, Seen) -> unique_sops(Rest, Seen, N, Answers)
    ; Answers = [C|Tail], Next is N-1, unique_sops(Rest, [C.sop|Seen], Next, Tail) ).

candidate(Q, score(4, N, 0), _{sop:Sop, source:example, support:N}) :-
    member(E, Q.examples), Sop = E.sop, (get_dict(count, E, N) -> true ; N = 1).
candidate(Q, score(3, Specificity, N), _{sop:Sop, source:template, support:N}) :-
    member(T, Q.templates), matches(T.pattern, Q.tokens, Q, [], Bindings),
    maplist(part(Bindings), T.parts, Parts), atomics_to_string(Parts, Sop),
    include(string, T.pattern, Anchors), length(Anchors, Specificity), N = T.count.
candidate(Q, score(2, Rank, Support), _{sop:Sop, source:alignment, support:Support, unread:Unread}) :-
    nth0(I, Q.transfers, T), Rank is -I, Support = T.support, Sop = T.sop, Unread = T.unread.
candidate(Q, Score, Candidate) :- lexical_candidate(Q, Score, Candidate).

lexical_candidate(Q, score(Tier, Score, 0), Candidate) :-
    member([Start,End,["act",Act,Mood,N],ActPrior], Q.actHits),
    predicate_admitted(Q, Start, End, Act),
    request_window(Q,Start-End,Act,WindowStart-WindowEnd,Intent,Question),
    Scoped = Q.put(scopeEnd,WindowEnd),
    span(Q.text, Start, End, Predicate), encode(Act, A), encode(Predicate, P),
    ( Mood == "" -> M = "" ; format(string(M), ' mood=~s', [Mood]) ),
    ( Question == "" -> Query = "" ; format(string(Query),' question=~s',[Question]) ),
    format(string(Req), '@r1 w.request.request act=~s~s predicate=~s~s', [A,M,P,Query]),
    ( ( get_dict(requiredTarget,Q,Hit) -> true ; member(Hit,Q.targetHits) ),
      Hit = [S,E,["target",Licence,Family,Declared,Sort,K],_],
      (Licence == "*" -> true ; Licence == Act),
      S >= WindowStart, E =< WindowEnd,
      target_mode(Declared,Act,Mode),
      span(Q.text, S, E, Surface),
      target_determiner(Q,Act,Family,S,Start-End,DetStart-Det),
      direct_target(Q, Act, Start-End, S-E, DetStart),
      target(Family, Mode, Sort, Surface, Det, T),
      attached_roles(Scoped, Act, Family, Mode, E, Attached, AttachmentBounds, Blocked, AttachmentFit, FirstConstraint),
      constraint_wires(Q, Act, Family, Mode, Intent, WindowStart-WindowEnd, Start-End, S-E, Blocked, FirstConstraint, More, Covered, Tier),
      role_fit(Q, Act, Start-End, Mode, Det, E, Covered, RoleFit),
      determiner_bounds(Q, DetStart, S, Det, DetBounds),
      append([Start-End,S-E|AttachmentBounds], Covered, BoundEvidence),
      append(DetBounds, BoundEvidence, Bounds),
      append([Req,T|Attached], More, Wires),
      length(More, Evidence), Gap is max(0,max(S-End,Start-E)),
      scope_fit(Q.roleScopes,Act,Start,End,S,E,ScopeFit),
      Extra is 5 + Evidence + RoleFit + AttachmentFit + ScopeFit + log(1+K)/2 - log(1+Gap)/2
    ; \+ get_dict(requiredTarget,Q,_), direct_reference(Q,Act,End,RS-RE), RE =< WindowEnd,
      format(string(ReferenceRequest),'~s refers=thing',[Req]),
      span(Q.text, RS, RE, Reference), encode(Reference, RefWords),
      format(string(ReferenceLookup),'@r1.ref w.request.lookup request=$r1 key=thing words=~s',[RefWords]),
      attached_roles(Scoped,Act,none,"existing",RE,Attached,Used,_,Fit,_),
      Bounds = [Start-End,RS-RE|Used], Wires = [ReferenceRequest,ReferenceLookup|Attached], Extra is 4 + Fit, Tier=1
    ; \+ get_dict(requiredTarget,Q,_), Bounds = [Start-End], Wires = [Req], Extra = 0, Tier=1 ),
    sort(Bounds, Sorted), string_length(Q.text, Length),
    residuals(Sorted, Q.text, 0, Length, 1, Unread),
    append(Wires, Unread, All), atomics_to_string(All, "\n", Sop),
    findall(1,(member([_,_,B,F],Q.tokens), once((member(L-R,Sorted),B>=L,F=<R))),CoveredTokens),
    length(CoveredTokens,Grounded), length(Q.tokens,Total), Coverage is Grounded / max(1,Total),
    Plain=_{sop:Sop,source:lexicon,support:N},
    ( nonvar(Family), get_dict(predicateModes,Q,Modes), memberchk([Start,End,Act,Family,ModeName],Modes),
      re_match("^[a-z][a-z_]*$",ModeName) -> Base=Plain.put(operationMode,ModeName) ; Base=Plain ),
    ( nonvar(Family), memberchk([S,E,Families],Q.ambiguousTargets), memberchk(Family,Families)
    -> Candidate=Base.put(binding,[Start,End,Act,S,E,Family]) ; Candidate=Base ),
    Score is 12*Coverage + Extra + ActPrior + log(1+N) + min(12,End-Start)/4 - Start/3.

% An exact canonical action name backed by a complete frame cannot be
% replaced by a learned sense or by an unlicensed head inside its operands.
% Other independently declared senses still compete.
predicate_admitted(Q, Start, End, Act) :-
    ( Q.groundedPredicates == [] -> true
    ; memberchk([Start,End,Grounded], Q.groundedPredicates) -> Act == Grounded
    ; memberchk([Start,End,Declared,_], Q.declaredActs), memberchk(Act,Declared) ).

request_window(Q,S-E,Act,A-B,Intent,Question) :-
    ( get_dict(scopes,Q,Scopes) ->
        member([A,B,Intent,Question],Scopes), S >= A, E =< B,
        ( Intent == "question" -> Act == "ask" ; Intent == "removal" -> Act == "remove" ; true )
    ; A=0, string_length(Q.text,B), Intent="action", Question="" ).

constraint_wires(Q, Act, Family, Mode, Intent, A-B, PS-PE, TS-TE, Blocked, First, Wires, Bounds, Tier) :-
    ( Q.allowConstraints == true ->
      findall(priority(Len,N)-hit(S,E,PhaseBody),
              ( member([S,E,["constraint",Licence,Family,Body,N],_], Q.constraintHits),
                (Licence == "*" -> true ; Licence == Act),
                S >= A, E =< B,
                (S >= PE ; E =< PS), (S >= TE ; E =< TS),
                \+ (member(L-R,Blocked), S < R, E > L),
                ( is_list(Body) -> (Intent == "action" ; Intent == "proposal"), S >= TE, PhaseBody=Body
                ; (Intent == "question" ; Intent == "removal") -> set_phase(Body,"selector",Phased), PhaseBody=[Phased]
                ; constraint_phase(Q, Act, Family, Mode, TS-TE, S-E, Body, Phased), PhaseBody=[Phased] ),
                Len is E-S ), Records),
      sort(Records, Sorted), reverse(Sorted, Ranked),
      choose_constraints(Ranked, [], Selected), sort(Selected, Chronological),
      numbered_constraints(Chronological, First, Wires, Bounds),
      ( member(hit(_,_,[_,_|_]),Chronological) -> Tier=3.5 ; Tier=1 )
    ; Wires=[], Bounds=[], Tier=1 ).

choose_constraints([], Acc, Acc).
choose_constraints([_-hit(S,E,Body)|Rest], Acc, Out) :-
    ( member(hit(A,B,_),Acc), S < B, E > A -> Next=Acc
    ; Next=[hit(S,E,Body)|Acc] ),
    choose_constraints(Rest,Next,Out).

numbered_constraints([], _, [], []).
numbered_constraints([hit(S,E,Bodies)|Rest], N, Wires, [S-E|Spans]) :-
    numbered_bodies(Bodies,N,Wires,Lines,Next),
    numbered_constraints(Rest,Next,Lines,Spans).

numbered_bodies([], N, Lines, Lines, N).
numbered_bodies([Body|Bodies], N, [Line|Wires], Lines, Next) :-
    format(string(Line),'@r1.c~d w.request.constraint request=$r1 ~s',[N,Body]),
    Following is N+1,
    numbered_bodies(Bodies,Following,Wires,Lines,Next).

target_mode("auto","make","new") :- !.
target_mode("auto",_,"existing") :- !.
target_mode(Mode,_,Mode).

determiner_bounds(_, _, _, "", []) :- !.
determiner_bounds(Q, Start, Target, Det, [Start-End]) :-
    member([Start,End,Det],Q.determiners), End =< Target, !.

target(Family, Mode, Sort, Surface, Det, Wire) :-
    encode(Family, F), encode(Surface, S),
    ( Sort == "" -> format(string(T), 'family_words=~s', [S])
    ; encode(Sort, Kind),
      ( Sort == Surface -> format(string(T), 'sort=~s', [Kind])
      ; format(string(T), 'sort=~s sort_words=~s', [Kind,S]) ) ),
    ( Sort == "", Mode \== "new" ->
      Lookup = "\n@r1.l1 w.request.lookup request=$r1 target=$r1.t key=thing from=page"
    ; Lookup = "" ),
    ( Det == "" -> D = "" ; format(string(D),' determiner=~s',[Det]) ),
    ( Mode == "existing", Sort == "" -> Fill = " fill=context"
    ; Mode == "existing" -> Fill = " fill=description"
    ; Fill = "" ),
    format(string(Wire), '@r1.t w.request.target request=$r1 family=~s mode=~s~s~s ~s~s', [F,Mode,D,Fill,T,Lookup]).

span(Text, Start, End, Value) :- Length is End-Start, sub_string(Text, Start, Length, _, Value).
residuals([], Text, Start, End, N, Lines) :- unread(Text,Start,End,N,Lines).
residuals([S-E|Tail], Text, From, End, N, Lines) :-
    GapEnd is max(S,From), NextStart is max(E,From),
    unread(Text,From,GapEnd,N,Here), length(Here,K), Next is N+K,
    residuals(Tail,Text,NextStart,End,Next,Rest), append(Here,Rest,Lines).
unread(Text,S,E,N,Lines) :-
    span(Text,S,E,Raw), re_replace("^\\s+|\\s+$"/g, "", Raw, Trim),
    ( re_match("[\\p{L}\\p{N}]", Trim) ->
      encode(Trim,V), format(string(Line),'@r1.u~d w.request.unread request=$r1 text=~s',[N,V]), Lines=[Line]
    ; Lines=[] ).

matches([], [], _, Bindings, Bindings).
matches([P|Ps], [Tok|Ts], Q, Bound, Result) :-
    string(P), !, Tok = [P,_,_,_], matches(Ps, Ts, Q, Bound, Result).
matches([P|Ps], Ts, Q, Bound, Result) :-
    is_dict(P), between(P.min,P.max,N), N > 0,
    length(Take,N), append(Take,Rest,Ts),
    Take = [[_,_,Start,_]|_], last(Take,[_,_,_,End]), span(Q.text,Start,End,Value),
    ( get_dict(kind,P,Kind) -> slot_value(Kind,Value) ; true ),
    ( get_dict(titleWidth,P,Width), N > Width ->
        supported_title(Take,Q.titleConnectors)
    ; true ),
    ( memberchk(P.slot-Existing,Bound) -> Existing == Value, Next = Bound
    ; Next = [P.slot-Value|Bound] ),
    matches(Ps, Rest, Q, Next, Result).

supported_title([First|Words],Connectors) :-
    capitalized_word(First), last(Words,Last), capitalized_word(Last),
    forall(member(Word,Words), (capitalized_word(Word) ; Word=[Key,_,_,_], memberchk(Key,Connectors))).

capitalized_word([_,Raw,_,_]) :- re_match("^[\\p{Lu}][\\p{L}\\p{M}\\p{N}_-]*$",Raw).

slot_value("number",V) :- re_match("^[+-]?[0-9]+(?:\\.[0-9]+)?$", V).
slot_value("date",V) :- re_match("^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$", V).
slot_value("time",V) :- re_match("^(?:[01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$", V).
slot_value("phrase",V) :- \+ re_match("[;.!?]|\\b(?:not|never|without|then|instead|but)\\b"/i,V).

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
