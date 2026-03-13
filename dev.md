A GitHub Pages static site that reads from the markdown source and turns it into a searchable company directory with cards and a map:



## Project Structure:

```ini
tech-ecosystem-kenya/
│
├── index.html
├── style.css
├── script.js
```

## Features:

- Responsive landing page and layout
- Live search
- Filters for sector, type, and location
- Card view for each parsed profile
- Interactive Leaflet map
- README-driven data loading via fetch('./README.md')- Client-side markdown parsing, so entries are not hardcoded

## Usage:

1. Clone the repository and navigate to the project directory.
2. Ensure you have a README.md file with the appropriate format for company profiles.
3. Open index.html in a web browser to view the directory.


## Future Improvements:

- Add pagination for large datasets
- Implement sorting options (e.g., by name, location)
- Enhance the map with clustering for dense areas
- Add a backend for dynamic data management and updates
- Improve accessibility and SEO features

This project serves as a template for creating a company directory using GitHub Pages, leveraging client-side JavaScript to parse markdown data and provide an interactive user experience.