## Trending endpoint swap

- Replaced homepage Trending section fetch from `/api/projects?sort=trending` with dedicated `/api/projects/trending`.
- `/api/projects/trending` ranks projects by number of ratings in the last 7 days and tie-breaks by average score. Falls back to top-rated when there is no recent rating activity.
- Kept homepage UI reuse of `ProjectCard` and existing "New this week" / "Top Projects" sections unchanged.
