-- Insert default room
INSERT OR IGNORE INTO rooms (id, name, description, created_at)
VALUES (1, 'Quoraのできるかなラボ', 'できるかなラボ用グループチャット', CURRENT_TIMESTAMP);

-- Note: Admin user will be created programmatically with proper PBKDF2 hash
-- Default admin credentials: login_id='admin', password='Admin@12345'
-- The hash will be generated on first startup if admin user doesn't exist
