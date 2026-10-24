-- The six top-level folders the app files things under. The seed creates them too; this
-- makes them exist on a production database that was only migrated, so "Add Client" and
-- "Convert lead" (which create a folder under Client Files) work on day one.
INSERT INTO "Folder" ("id", "name", "category", "color", "createdAt", "updatedAt") VALUES
    ('folder_client_files',   'Client Files',   'CLIENT_FILES',   '#308CFC', NOW(), NOW()),
    ('folder_project_files',  'Project Files',  'PROJECT_FILES',  '#902EFC', NOW(), NOW()),
    ('folder_design_assets',  'Design Assets',  'DESIGN_ASSETS',  '#FC6C78', NOW(), NOW()),
    ('folder_video_assets',   'Video Assets',   'VIDEO_ASSETS',   '#FC9C0E', NOW(), NOW()),
    ('folder_documents',      'Documents',      'DOCUMENTS',      '#04CC88', NOW(), NOW()),
    ('folder_team_resources', 'Team Resources', 'TEAM_RESOURCES', '#64748B', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- One running timer per user: Start pressed on two devices at once must not create two.
CREATE UNIQUE INDEX "TimeEntry_one_running_per_user" ON "TimeEntry" ("userId") WHERE "status" = 'RUNNING';
