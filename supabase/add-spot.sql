-- 2026-08 衛生與整潔：新增「常見錯誤／衛生點」分區（section='spot'）
-- 放寬 cleaning_items.section 的 CHECK 限制以容納 spot
alter table cleaning_items drop constraint if exists cleaning_items_section_check;
alter table cleaning_items add constraint cleaning_items_section_check
  check (section in ('daily', 'spot', 'cycle', 'deep'));
