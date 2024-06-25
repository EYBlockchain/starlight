this.db.createUser({
  user: 'admin',
  pwd: 'admin',
  roles: [
    { role: 'userAdmin', db: 'merkle_tree' },
    { role: 'dbAdmin', db: 'merkle_tree' },
    { role: 'readWrite', db: 'merkle_tree' },
    { role: 'userAdmin', db: 'zapp_db' },
    { role: 'dbAdmin', db: 'zapp_db' },
    { role: 'readWrite', db: 'zapp_db' },
  ],
});
