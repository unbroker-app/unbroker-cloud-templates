# PrestaShop

Open-source e-commerce: a complete online store with catalog, cart, checkout,
payments, shipping, taxes and thousands of modules and themes.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **PrestaShop** | `prestashop/prestashop:9.2.0-apache` | Public. PrestaShop 9.2.0 on PHP 8.5 + Apache. The store lives on a 5 GB volume |
| **db** | MySQL 8 | Internal. Products, orders, customers |

## After deploy

The **first boot takes a few minutes**: it downloads PrestaShop 9.2.0 (checked
against its published checksum), installs it on the volume and creates your
admin. The service logs say `PrestaShop installed` when it's done.

- **Store front**: your URL.
- **Back office**: `https://<your-url>/<ADMIN_FOLDER>`. Sign in with the admin
  email and password from the deploy form.

The store starts empty (no demo products). Add products, payment and shipping
modules from the back office.

## Good to know

- **Keep your URL.** PrestaShop stores its domain in the database. If you add
  a custom domain later, also change it in **Shop Parameters → Traffic & SEO →
  Shop domain** (and keep SSL on).
- PrestaShop's code lives on the volume, because it edits its own files (cache,
  modules, themes). Upgrade the store with PrestaShop's **1-Click Upgrade**
  module, not by changing the image tag: a new image doesn't touch an existing
  installation.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FOLDER`, `SHOP_NAME`, `SHOP_COUNTRY`
  and `SHOP_LANGUAGE` are only used by the first install.
- Configure email under **Advanced Parameters → E-mail** (SMTP) so order
  confirmations reach your customers.
