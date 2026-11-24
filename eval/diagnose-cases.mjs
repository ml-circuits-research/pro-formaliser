// Scoped review probes for the pinned bucket-0 release disagreements.
// Source rows remain in WebMeet. Reports explain the independent judgments.
export const releaseCases = [
  {
    source: 'document/text-01.csv', row: 1398, category: 'mechanism',
    scope: 'Recover exact replacement text as a section content update.',
    review: 'ROLE-AUDIT.md #14. The utterance specifies replacement and quotes the new text.',
    witness: 'annotation',
    probes: {
      contrast: {
        text: 'change the section content "The room is available after lunch."',
        wire: { type: 'constraint', attribute: 'section.content', value: 'The room is available after lunch.' },
      },
    },
  },
  {
    source: 'calendar/meetings-07.csv', row: 444, category: 'mechanism',
    scope: 'Generate the plausible weekday assignment as a candidate.',
    review: 'ROLE-AUDIT.md #2. Friday can specify the meeting day. The review concerns candidate generation while leaving the referent and active interpretation open.',
    witness: 'annotation',
    probes: {
      contrast: {
        text: 'move the meeting day Friday',
        wire: { type: 'constraint', attribute: 'meeting.day', phase: 'result', value: 'Friday' },
      },
    },
  },
  {
    source: 'diagram/charts-04.csv', row: 3967, category: 'missing_knowledge',
    scope: 'Recognize the surface label of the existing chart.colourBarLength key.',
    review: 'The held-out request says “colour bar length medium”. The key exists and licenses medium. Inserting the explicit chart noun isolates the property reader from metonymic chart selection.',
    witness: 'annotation',
    probes: {
      overlay: {
        sop: '@diagnosis.colour_length core.word text="colour bar length" means=chart.colourBarLength',
        surface: 'colour bar length medium',
        family: 'chart',
        contrast: 'make the chart colour bar length medium',
        wire: { type: 'constraint', attribute: 'chart.colourBarLength', value: 'medium' },
      },
    },
  },
  {
    source: 'diagram/diagrams-04.csv', row: 226, category: 'ambiguous_context',
    scope: 'Resolve which object family the name Kickoff identifies.',
    review: 'ROLE-AUDIT.md #9. The name and color edit are explicit, while the text does not identify the family.',
    witness: 'annotation',
    probes: {
      contexts: [
        { context: { entities: [{ family: 'node', name: 'Kickoff', selected: true }] }, family: 'node' },
        { context: { entities: [{ family: 'drawn', name: 'Kickoff', selected: true }] }, family: 'drawn' },
      ],
    },
  },
  {
    source: 'document/text-03.csv', row: 1585, category: 'annotation',
    scope: 'The annotation models a request to add a paragraph as an existing target.',
    review: 'ROLE-AUDIT.md #15. The operation creates a paragraph. The bare 3 does not establish a level; the witness leaves it and the adjacent name unresolved.',
    witness: [
      '@r w.request.request act=make mood=do predicate=add',
      '@t w.request.target request=$r family=block mode=new determiner=indefinite sort=paragraph sort_words=paargraph',
      '@u w.request.unread request=$r text="Main Track 3"',
    ].join('\n'),
  },
  {
    source: 'diagram/charts-04.csv', row: 4044, category: 'unknown',
    scope: 'Determine what “outward the same” carries from the previous chart adjustment.',
    review: 'ROLE-AUDIT.md #7. The supplied turn cannot establish the previous change, and the annotation’s value same does not bind a previous delta. A missing structural capability has not been demonstrated.',
    witness: 'annotation',
    schema: {
      type: 'w.request.constraint',
      slot: 'antecedent',
      extension: '@diagnosis.antecedent core.slot of=w.request.constraint key=antecedent type=w.request.constraint',
      witness: [
        '@prior w.request.request act=change',
        '@prior.c w.request.constraint request=$prior on=attribute attribute=chart.pieLabelDistance value=further',
        '@next w.request.request act=change',
        '@next.c w.request.constraint request=$next on=attribute attribute=chart.pieLabelDistance value=same antecedent=$prior.c',
      ].join('\n'),
      alternatives: [{
        sop: [
          '@next w.request.request act=change',
          '@next.c w.request.constraint request=$next on=attribute attribute=chart.pieLabelDistance value=same',
          '@next.l w.request.lookup request=$next constraint=$next.c key=value from=previous',
        ].join('\n'),
        nativeValid: true,
        rationale: 'A previous-value lookup is legal and leaves the specific antecedent constraint implicit.',
      }],
    },
  },
];
