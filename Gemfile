source "https://rubygems.org"

# Hello! This is where you manage which Jekyll version is used to run.
# When you want to use a different version, change it below, save the
# file and run `bundle install`. Run Jekyll with `bundle exec`, like so:
#
#     bundle exec jekyll serve
#
# This will help ensure the proper Jekyll version is running.
# Happy Jekylling!
gem "jekyll", "~> 3.8.5"

# This is the default theme for new Jekyll sites. You may change this to anything you like.

# If you want to use GitHub Pages, remove the "gem "jekyll"" above and
# uncomment the line below. To upgrade, run `bundle update github-pages`.
# gem "github-pages", group: :jekyll_plugins
gem "minima", "~> 2.5.0"
gem "concurrent-ruby", "~> 1.1.4"

# Performance optimizations
gem "liquid-c", "~> 4.0.0"  # Accélère le rendu Liquid
gem "sassc", "~> 2.0.1"     # Accélère le rendu Sass
gem "rake", "~> 12.3.3"     # Nécessaire pour sassc

# If you have any plugins, put them here!
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.11.0"
  gem "jekyll-seo-tag", "~> 2.5.0"
  gem "jekyll-sitemap", "~> 1.2.0"
end

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.0" if Gem.win_platform?

