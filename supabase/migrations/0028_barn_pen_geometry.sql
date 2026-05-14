-- ===================================================================
-- 0028_barn_pen_geometry.sql
-- Geometry + layout fields so the Infrastructure page can render a
-- barn-shaped visual with pens drawn inside.
--
-- Layouts model the most common dairy barn shapes:
--   single_side  - pens along one side of a feed alley
--   double_side  - pens on both sides of a central feed alley
--                  (most common for medium-large dairies)
--   free         - custom layout, pens placed by the user
--
-- All geometry is in feet. Optional fields — if missing, the renderer
-- falls back to an auto-flow layout sized by capacity_head.
-- ===================================================================

do $$ begin
  alter table public.barns
    add column if not exists length_ft numeric(8, 2),
    add column if not exists width_ft  numeric(8, 2),
    add column if not exists layout    text not null default 'double_side',
    add column if not exists alley_width_ft numeric(6, 2);
exception when undefined_table then null; end $$;

do $$ begin
  alter table public.barns
    add constraint barns_layout_check
      check (layout in ('single_side', 'double_side', 'free'));
exception
  when duplicate_object then null;
  when others then null;
end $$;

do $$ begin
  alter table public.pens
    add column if not exists length_ft numeric(8, 2),
    add column if not exists width_ft  numeric(8, 2),
    add column if not exists position_index int not null default 0,
    add column if not exists side text;
exception when undefined_table then null; end $$;

do $$ begin
  alter table public.pens
    add constraint pens_side_check
      check (side is null or side in ('left', 'right'));
exception
  when duplicate_object then null;
  when others then null;
end $$;

create index if not exists pens_barn_position_idx
  on public.pens(barn_id, position_index);

comment on column public.barns.layout is
  'single_side | double_side | free — drives the visual renderer';
comment on column public.barns.length_ft is
  'Long-axis length of the barn in feet (alley runs along this axis).';
comment on column public.barns.width_ft is
  'Short-axis width of the barn in feet.';
comment on column public.pens.position_index is
  'Order of this pen along the barn''s long axis (smallest first).';
comment on column public.pens.side is
  'For double_side barns: left or right of the central feed alley. NULL on single_side / free.';
