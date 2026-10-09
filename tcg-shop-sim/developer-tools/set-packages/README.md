# Build-time set packages

Place each complete, validated set package in a subfolder here with all of its
referenced card and product images. The development and production build
scripts validate these packages and compile them into the application catalog.

Do not put standalone product-packaging manifests here; the compiler expects
full set packages containing `game`, `set`, and `card_data`.
