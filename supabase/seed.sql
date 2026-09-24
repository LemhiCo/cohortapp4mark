-- Local and preview seed. Production admin emails and customer data are added explicitly.
insert into public.admin_allowlist (email)
values ('admin@lemhi.com')
on conflict (email) do nothing;

insert into public.programs (id, name, active)
values ('10000000-0000-4000-8000-000000000001', 'Lemhi Cohort Program', true)
on conflict (id) do update set name = excluded.name, active = excluded.active;

insert into public.program_weeks (id, program_id, week_number, title, subtitle, goal)
values
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    'Launch',
    'Platform onboarding, tenant setup, and internal alignment',
    'Get the right people aligned and establish a working Lemhi foundation.'
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    2,
    'Build the motion',
    'Positioning, targeting, and the first repeatable workflow',
    'Turn the foundation into a clear client-facing motion your team can repeat.'
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    3,
    'Activate',
    'Put the workflow into practice with real opportunities',
    'Use the program with live accounts and remove the first operational blockers.'
  ),
  (
    '11000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    4,
    'Scale',
    'Review results, close gaps, and set the next operating rhythm',
    'Finish the cohort with a repeatable plan and clear next actions.'
  )
on conflict (id) do update set
  week_number = excluded.week_number,
  title = excluded.title,
  subtitle = excluded.subtitle,
  goal = excluded.goal;

insert into public.program_tasks (
  id, program_id, week_id, position, title, description, owner_label, owner_type, kind
)
values
  ('12000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 1, 'Review the cohort roadmap', 'Confirm the four-week plan and the outcomes your team is working toward.', 'vCIO / Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 2, 'Attend platform onboarding', 'Join the onboarding session and identify any access or setup questions.', 'Cohort team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 3, 'Confirm the tenant setup owner', 'Choose the person responsible for coordinating tenant setup and internal follow-through.', 'MSP IT admin', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 4, 'Configure the Lemhi tenant', 'Complete the initial tenant configuration with the MSP setup owner.', 'Lemhi team', 'lemhi', 'task'),
  ('12000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 5, 'Align the internal cohort team', 'Agree on roles, the weekly working rhythm, and who needs visibility into progress.', 'vCIO / Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 6, 'Complete the first client assessment', 'Complete the assessment in Lemhi Engage. A Lemhi admin confirms this task here.', 'Lemhi team', 'lemhi', 'task'),
  ('12000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 7, 'Week 1 launch checkpoint', 'Confirm the MSP is ready to move from setup into the working motion.', 'Lemhi cohort lead', 'lemhi', 'checkpoint'),

  ('12000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 1, 'Define the ideal starting client profile', 'Describe the client characteristics that make the first motion most likely to succeed.', 'vCIO / Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 2, 'Select the first target accounts', 'Choose a focused group of existing clients for the first activation cycle.', 'Account team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 3, 'Review the positioning guide', 'Adapt the recommended language to match your clients and service model.', 'Marketing / Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 4, 'Draft the client conversation', 'Prepare the opening, discovery questions, and next-step language for client meetings.', 'vCIO / Account team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 5, 'Confirm the internal handoff', 'Document how an opportunity moves from the client conversation into delivery.', 'Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 6, 'Review the working motion', 'Review the MSP draft and record the changes needed before activation.', 'Lemhi cohort lead', 'lemhi', 'task'),
  ('12000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 7, 'Schedule the first client conversations', 'Put the first conversations on the calendar and confirm owners.', 'Account team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 8, 'Week 2 motion checkpoint', 'Confirm positioning, targets, and the handoff are ready for live use.', 'Lemhi cohort lead', 'lemhi', 'checkpoint'),

  ('12000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 1, 'Run the first client conversation', 'Use the motion with a live client and capture what worked and what stalled.', 'vCIO / Account team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 2, 'Record client feedback', 'Capture the client questions, objections, and language that resonated.', 'Account team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 3, 'Update the target account list', 'Prioritize the next accounts using what the first conversation revealed.', 'vCIO / Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 4, 'Refine the client conversation', 'Adjust the opening, discovery questions, and call to action based on feedback.', 'Marketing / Account team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 5, 'Confirm delivery readiness', 'Make sure the internal team can deliver on the next step being offered to clients.', 'MSP IT admin', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 6, 'Review live-account progress', 'Review activity and unblock any stalled opportunity with the MSP team.', 'Lemhi cohort lead', 'lemhi', 'task'),
  ('12000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 7, 'Plan the next activation cycle', 'Choose the next accounts, owners, and dates for continued outreach.', 'Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 8, 'Week 3 activation checkpoint', 'Confirm the motion has been used with a live account and the next cycle is planned.', 'Lemhi cohort lead', 'lemhi', 'checkpoint'),

  ('12000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 1, 'Review cohort outcomes', 'Compare the work completed with the outcomes your team set in Week 1.', 'Cohort team', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 2, 'Document the repeatable workflow', 'Write down the owners, steps, and handoffs the team will keep using.', 'Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 3, 'Set the ongoing operating rhythm', 'Schedule the internal review cadence and the next Lemhi check-in.', 'vCIO / Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 4, 'Close remaining setup gaps', 'Resolve the outstanding configuration or process issues found during the cohort.', 'MSP IT admin', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000028', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 5, 'Confirm the post-cohort plan', 'Review the next actions and ongoing check-in plan with the MSP.', 'Lemhi cohort lead', 'lemhi', 'task'),
  ('12000000-0000-4000-8000-000000000029', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 6, 'Share the operating plan internally', 'Make the final workflow and cadence visible to everyone responsible for it.', 'Practice Lead', 'msp', 'task'),
  ('12000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 7, 'Cohort completion checkpoint', 'Confirm every required task and checkpoint is complete and transition to ongoing check-ins.', 'Lemhi cohort lead', 'lemhi', 'checkpoint')
on conflict (id) do update set
  week_id = excluded.week_id,
  position = excluded.position,
  title = excluded.title,
  description = excluded.description,
  owner_label = excluded.owner_label,
  owner_type = excluded.owner_type,
  kind = excluded.kind;

-- The 19 starter-file binaries are intentionally not represented as ready assets here.
-- Add them with scripts/upload-starter-assets.mjs once Lemhi supplies the source files and titles.
