# Random audit of reasonable meaning

100 rows sampled without replacement from the primary 1% text-only holdout in benchmark order (Python random.Random(905184).sample). Four LLM reviewers each assessed a separate batch of 25 with randomized system/annotation sides. All rows were eligible, including matches. G means the main intent is reasonable, W indicates a material error or omission, and U indicates uncertainty. The application area was visible to reviewers, who were asked to assess each circuit both ignoring and considering it. All system predictions were generated from text alone. These are sample estimates for the pinned corpus, not human adjudications.

Reader levels: L0 – Fail (no reading or refusal), L1 – Wrong (a material action, target or value is incorrect), L1 – Incomplete (direction is right but a material part is missing), L2+ – Reasonable (main intent preserved, including fully correct readings). When both error types apply, Wrong takes precedence. Unclear records uncertainty separately. The original text-only W cases were reexamined on anonymized sides to distinguish Wrong from Incomplete.


| Source row | Reader, text criterion | Annotation, intended area | Reader, intended area | Reader level (text) |
| --- | --- | --- | --- | --- |
| drawing/scenes-10.csv #212 | W | G | W | L1 – Wrong |
| diagram/nodes-12.csv #3313 | U | G | G | Unclear |
| diagram/nodes-12.csv #3839 | W | G | W | L1 – Incomplete |
| document/text-01.csv #2181 | G | G | G | L2+ – Reasonable |
| drawing/scenes-05.csv #2522 | W | G | W | L1 – Wrong |
| drawing/scenes-15.csv #1084 | W | G | W | L1 – Wrong |
| diagram/diagrams-03.csv #1998 | W | W | W | L1 – Wrong |
| drawing/scenes-14.csv #482 | W | W | W | L1 – Incomplete |
| drawing/scenes-10.csv #1484 | W | W | W | L1 – Wrong |
| drawing/scenes-14.csv #150 | G | G | G | L2+ – Reasonable |
| drawing/scenes-21.csv #161 | W | G | W | L1 – Incomplete |
| diagram/charts-02.csv #4094 | W | G | W | L1 – Wrong |
| drawing/placement-06.csv #2058 | G | G | G | L2+ – Reasonable |
| diagram/charts-01.csv #3835 | W | W | W | L1 – Incomplete |
| drawing/placement-06.csv #2985 | G | G | G | L2+ – Reasonable |
| drawing/objects-01.csv #677 | W | W | W | L1 – Wrong |
| document/text-02.csv #2747 | W | G | W | L1 – Incomplete |
| diagram/charts-06.csv #1915 | W | G | W | L1 – Incomplete |
| diagram/nodes-13.csv #1080 | W | G | W | L1 – Incomplete |
| drawing/people-05.csv #876 | W | G | W | L1 – Wrong |
| diagram/nodes-04.csv #124 | W | W | W | L1 – Wrong |
| drawing/people-04.csv #1113 | U | U | U | Unclear |
| diagram/charts-02.csv #636 | W | G | W | L1 – Wrong |
| drawing/scenes-13.csv #3856 | W | G | W | L1 – Wrong |
| diagram/nodes-06.csv #703 | G | G | G | L2+ – Reasonable |
| document/text-01.csv #2434 | G | G | G | L2+ – Reasonable |
| diagram/diagrams-03.csv #10 | W | W | W | L1 – Wrong |
| diagram/nodes-01.csv #4637 | W | W | W | L1 – Wrong |
| diagram/diagrams-01.csv #1115 | W | W | W | L1 – Wrong |
| drawing/people-01.csv #606 | W | W | W | L1 – Wrong |
| diagram/nodes-01.csv #2685 | W | G | W | L1 – Wrong |
| drawing/scenes-16.csv #2095 | W | G | W | L1 – Wrong |
| diagram/nodes-13.csv #277 | W | G | W | L1 – Wrong |
| document/text-01.csv #2886 | G | G | G | L2+ – Reasonable |
| diagram/charts-03.csv #935 | W | W | W | L1 – Incomplete |
| diagram/charts-03.csv #1318 | W | U | W | L1 – Wrong |
| diagram/nodes-06.csv #1543 | G | G | G | L2+ – Reasonable |
| drawing/people-07.csv #159 | G | G | G | L2+ – Reasonable |
| diagram/charts-06.csv #2165 | W | U | W | L1 – Wrong |
| drawing/scenes-05.csv #297 | G | G | G | L2+ – Reasonable |
| diagram/diagrams-01.csv #4355 | W | W | W | L1 – Wrong |
| diagram/nodes-04.csv #4036 | W | G | W | L1 – Wrong |
| drawing/scenes-06.csv #134 | W | G | W | L1 – Wrong |
| drawing/scenes-11.csv #3651 | W | G | W | L1 – Wrong |
| diagram/nodes-07.csv #2132 | W | G | W | L1 – Wrong |
| drawing/scenes-10.csv #1196 | W | G | W | L1 – Wrong |
| diagram/charts-07.csv #272 | W | G | W | L1 – Wrong |
| diagram/diagrams-04.csv #372 | U | G | W | Unclear |
| drawing/objects-03.csv #2289 | G | G | G | L2+ – Reasonable |
| diagram/charts-02.csv #3029 | W | W | W | L1 – Wrong |
| diagram/nodes-02.csv #2414 | W | W | W | L1 – Incomplete |
| diagram/charts-02.csv #3551 | W | G | W | L1 – Wrong |
| diagram/nodes-05.csv #1977 | W | W | W | L1 – Wrong |
| drawing/people-05.csv #1305 | W | G | W | L1 – Wrong |
| diagram/charts-03.csv #1946 | W | G | W | L1 – Wrong |
| diagram/diagrams-07.csv #74 | G | G | G | L2+ – Reasonable |
| diagram/nodes-02.csv #2943 | W | W | W | L1 – Incomplete |
| diagram/nodes-02.csv #2039 | W | W | W | L1 – Wrong |
| drawing/placement-02.csv #1350 | W | U | W | L1 – Wrong |
| diagram/ui-coverage.csv #653 | W | W | W | L1 – Incomplete |
| diagram/nodes-06.csv #3184 | W | G | W | L1 – Incomplete |
| drawing/scenes-04.csv #509 | G | G | G | L2+ – Reasonable |
| drawing/scenes-05.csv #776 | W | G | W | L1 – Wrong |
| diagram/nodes-01.csv #795 | W | W | W | L1 – Wrong |
| drawing/scenes-11.csv #1719 | W | W | W | L1 – Wrong |
| drawing/people-08.csv #172 | W | W | W | L1 – Wrong |
| drawing/scenes-20.csv #933 | W | G | W | L1 – Wrong |
| document/text-03.csv #428 | W | G | W | L1 – Wrong |
| document/text-01.csv #50 | G | G | G | L2+ – Reasonable |
| diagram/charts-06.csv #3033 | W | W | W | L1 – Wrong |
| drawing/scenes-20.csv #1617 | W | U | W | L1 – Incomplete |
| drawing/placement-06.csv #1483 | G | G | G | L2+ – Reasonable |
| document/text-01.csv #4789 | W | G | W | L1 – Wrong |
| drawing/scenes-13.csv #1288 | G | G | G | L2+ – Reasonable |
| drawing/scenes-03.csv #1565 | W | G | W | L1 – Wrong |
| drawing/scenes-06.csv #2319 | W | G | W | L1 – Wrong |
| diagram/nodes-06.csv #3410 | W | G | W | L1 – Incomplete |
| drawing/scenes-10.csv #3444 | W | G | W | L1 – Incomplete |
| diagram/diagrams-03.csv #3822 | W | G | W | L1 – Incomplete |
| diagram/nodes-06.csv #1059 | G | G | G | L2+ – Reasonable |
| diagram/nodes-12.csv #987 | W | G | W | L1 – Incomplete |
| drawing/scenes-20.csv #1420 | W | U | W | L1 – Wrong |
| diagram/nodes-06.csv #2987 | G | G | G | L2+ – Reasonable |
| calendar/meetings-03.csv #254 | W | G | W | L1 – Wrong |
| drawing/placement-02.csv #950 | W | G | W | L1 – Incomplete |
| drawing/scenes-03.csv #1110 | W | G | W | L1 – Wrong |
| drawing/scenes-08.csv #2593 | W | G | W | L1 – Wrong |
| diagram/nodes-05.csv #2474 | W | W | W | L1 – Incomplete |
| diagram/nodes-01.csv #1312 | G | G | G | L2+ – Reasonable |
| document/text-08.csv #19 | W | G | W | L1 – Incomplete |
| diagram/nodes-04.csv #1983 | G | G | G | L2+ – Reasonable |
| drawing/scenes-06.csv #960 | G | G | G | L2+ – Reasonable |
| diagram/diagrams-01.csv #1442 | W | W | W | L1 – Incomplete |
| document/text-02.csv #1209 | W | G | W | L1 – Incomplete |
| diagram/nodes-02.csv #2706 | W | W | W | L1 – Incomplete |
| diagram/diagrams-04.csv #2011 | G | G | G | L2+ – Reasonable |
| drawing/placement-02.csv #3051 | W | G | W | L1 – Wrong |
| diagram/charts-02.csv #358 | W | G | W | L1 – Incomplete |
| diagram/diagrams-01.csv #197 | W | G | W | L1 – Wrong |
| drawing/placement-02.csv #3081 | G | G | G | L2+ – Reasonable |
