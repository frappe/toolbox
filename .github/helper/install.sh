#!/bin/bash
# Bootstrap a Frappe bench and a test site with the toolbox app installed. MariaDB and Redis come
# from the service containers the workflow declares.
set -e

cd "$HOME" || exit 1

pip install frappe-bench

# Frappe comes from `develop`: this app targets Frappe 17. Redis config generation is skipped
# because CI provides Redis on the ports Frappe's default common_site_config expects, cache 13000
# and queue 11000. Assets are skipped here and built later, and only where they are needed.
bench init --skip-redis-config-generation --skip-assets \
  --frappe-branch develop --python "$(which python)" frappe-bench

# Frappe requires utf8mb4 on the server.
mysql --host 127.0.0.1 --port 3306 -u root -proot -e "SET GLOBAL character_set_server = 'utf8mb4'"
mysql --host 127.0.0.1 --port 3306 -u root -proot -e "SET GLOBAL collation_server = 'utf8mb4_unicode_ci'"

cd "$HOME/frappe-bench" || exit 1

# `bench get-app` COPIES the checkout into apps/toolbox. Anything built in the workspace after this
# point never reaches the app that gets served.
bench get-app toolbox "${GITHUB_WORKSPACE}"
bench new-site --db-root-password root --admin-password admin \
  --no-mariadb-socket --install-app toolbox test_site
bench --site test_site set-config allow_tests true
