ALTER TYPE showroom.blog_block_type ADD VALUE IF NOT EXISTS 'link_button';
ALTER TYPE showroom.blog_block_type ADD VALUE IF NOT EXISTS 'guide_box';

NOTIFY pgrst, 'reload schema';
