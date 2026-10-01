-- Make individual workspaces completion-driven, attach the real starter
-- library to roadmap stages, and use program-neutral template language.

create or replace function public.cohort_current_week(target_cohort_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (now() at time zone c.timezone)::date < c.start_date then 0::smallint
    when c.workspace_type = 'cohort'
      and (now() at time zone c.timezone)::date >= c.start_date + 28 then 5::smallint
    when c.workspace_type = 'cohort' then
      least(4, (floor(((now() at time zone c.timezone)::date - c.start_date) / 7.0) + 1)::smallint)
    else coalesce((
      select min(cw.week_number)::smallint
      from public.cohort_weeks cw
      where cw.cohort_id = c.id
        and exists (
          select 1
          from public.msps m
          join public.cohort_tasks ct
            on ct.cohort_id = m.cohort_id
           and ct.cohort_week_id = cw.id
           and (ct.msp_id is null or ct.msp_id = m.id)
           and ct.archived_at is null
          left join public.msp_hidden_tasks hidden
            on hidden.msp_id = m.id
           and hidden.cohort_task_id = ct.id
          left join public.task_completions completion
            on completion.msp_id = m.id
           and completion.cohort_task_id = ct.id
          where m.cohort_id = c.id
            and m.status = 'active'
            and hidden.cohort_task_id is null
            and completion.cohort_task_id is null
        )
    ), 5::smallint)
  end
  from public.cohorts c
  where c.id = target_cohort_id;
$$;

-- The files stay program-scoped and stored once. The week relationship only
-- controls where each existing file is surfaced in the four-stage roadmap.
update public.assets a
set program_week_id = pw.id,
    program_task_id = null
from public.program_weeks pw
where a.scope = 'program'
  and a.program_id = pw.program_id
  and pw.week_number = case
    when a.title in (
      'AI Readiness Survey Template',
      'AI Transformation Process Client Diagram',
      'Lemhi AI Journey Diagram',
      'Pre-Assessment Sales Playbook',
      'Security and Privacy Overview'
    ) then 1
    when a.title in (
      'Build My Offer Assistant Instructions',
      'The Forward Deployed Engineer',
      'Transformation as a Service',
      'Two Ways to Sell Managed AI Services',
      'Virtual Chief AI Officer (VCAIO)'
    ) then 2
    when a.title in (
      'AI EOS Proposal Template',
      'AI Objection Handling Guide',
      'AI Planner Template',
      'Lemhi Conversation Coach',
      'VCAIO Platform Educational Deck'
    ) then 3
    when a.title in (
      'AI Enablement Workshop Template',
      'Lemhi Design Partner Checklist',
      'Quarterly Business Review (QBR)',
      'The Monthly AI Council'
    ) then 4
  end
  and a.title in (
    'AI Readiness Survey Template',
    'AI Transformation Process Client Diagram',
    'Lemhi AI Journey Diagram',
    'Pre-Assessment Sales Playbook',
    'Security and Privacy Overview',
    'Build My Offer Assistant Instructions',
    'The Forward Deployed Engineer',
    'Transformation as a Service',
    'Two Ways to Sell Managed AI Services',
    'Virtual Chief AI Officer (VCAIO)',
    'AI EOS Proposal Template',
    'AI Objection Handling Guide',
    'AI Planner Template',
    'Lemhi Conversation Coach',
    'VCAIO Platform Educational Deck',
    'AI Enablement Workshop Template',
    'Lemhi Design Partner Checklist',
    'Quarterly Business Review (QBR)',
    'The Monthly AI Council'
  );

update public.programs
set name = 'Lemhi Growth Program'
where name = 'Lemhi Cohort Program';

update public.program_weeks
set goal = replace(goal, 'Finish the cohort', 'Finish the program')
where goal like '%Finish the cohort%';

update public.program_tasks
set title = case title
      when 'Review the cohort roadmap' then 'Review the growth roadmap'
      when 'Align the internal cohort team' then 'Align the internal program team'
      when 'Review cohort outcomes' then 'Review program outcomes'
      when 'Confirm the post-cohort plan' then 'Confirm the ongoing plan'
      when 'Cohort completion checkpoint' then 'Program completion checkpoint'
      else title
    end,
    description = replace(description, 'during the cohort', 'during the program'),
    owner_label = case owner_label
      when 'Cohort team' then 'Program team'
      when 'Lemhi cohort lead' then 'Lemhi lead'
      else owner_label
    end;

update public.cohort_weeks
set goal = replace(goal, 'Finish the cohort', 'Finish the program')
where goal like '%Finish the cohort%';

update public.cohort_tasks
set title = case title
      when 'Review the cohort roadmap' then 'Review the growth roadmap'
      when 'Align the internal cohort team' then 'Align the internal program team'
      when 'Review cohort outcomes' then 'Review program outcomes'
      when 'Confirm the post-cohort plan' then 'Confirm the ongoing plan'
      when 'Cohort completion checkpoint' then 'Program completion checkpoint'
      else title
    end,
    description = replace(description, 'during the cohort', 'during the program'),
    owner_label = case owner_label
      when 'Cohort team' then 'Program team'
      when 'Lemhi cohort lead' then 'Lemhi lead'
      else owner_label
    end;
