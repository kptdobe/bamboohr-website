import {
  loadFragment,
  lookupPages,
  fetchPlaceholders,
  readBlockConfig,
  toCamelCase,
  toCategory,
  toClassName,
} from '../../scripts/scripts.js';
import { createAppCard, sortOptions } from '../app-cards/app-cards.js';

function addGroupLabel(groupName, parentContainer) {
  const groupLabel = document.createElement('h2');
  groupLabel.classList = 'block-group-label';
  groupLabel.innerHTML = groupName;
  parentContainer.append(groupLabel);
}

function addEndGroupLabel(groupName, parentContainer, siblingContainer = null) {
  const endGroupLabel = document.createElement('h6');
  endGroupLabel.classList = 'block-end-group-label';
  endGroupLabel.innerHTML = `- end ${groupName} group -`;
  if (siblingContainer) parentContainer.insertBefore(endGroupLabel, siblingContainer);
  else parentContainer.append(endGroupLabel);
}

async function addBlockLinks(parentContainer, blockName) {
  const noLinks = ['container-backgrounds'];
  const blockLinks = document.createElement('div');
  blockLinks.classList = 'block-links';
  parentContainer.append(blockLinks);

  const blockNameSanitized = toClassName(blockName);
  if (!noLinks.includes(blockNameSanitized)) {
    // Add links
    let collection = 'blockTracker';
    lookupPages([], collection, blockNameSanitized).then(results => {
      const collectionCache = `${collection}${blockNameSanitized}`;
      const trackerListings = window.pageIndex[collectionCache];

      const uniqueLinks = [];
      trackerListings.data.forEach(l => {
        if (l && !uniqueLinks.find(u => u.Title === l.Title)) uniqueLinks.push(l);
      });

      const blockLinksLabel = document.createElement('h3');
      blockLinksLabel.classList = 'block-links-label';
      blockLinksLabel.innerHTML = `The ${blockName} block is used on ${uniqueLinks.length} pages:`;
      blockLinks.append(blockLinksLabel);

      // const limitedUniqueLinks = uniqueLinks.filter((l, index) => index < 10);

      uniqueLinks.some((link, index) => {
        const blockExampleLink = document.createElement('a');
        blockExampleLink.className = 'block-example-link';
        //blockExampleLink.href = '#'; // link.path
        blockExampleLink.textContent = link.Title;

        blockLinks.append(blockExampleLink);

        // For now only show 10
        return index >= 9;
      });

      // Add a separator
      const sepContainer = document.createElement('div');
      sepContainer.classList = 'block-links-sep';
      const sep = document.createElement('hr');
      sep.classList = 'separator-horiz-line';
      sepContainer.append(sep);
      blockLinks.append(sepContainer);
    });
  }
}

function getBlockHTML(ph) {
  return /* html */ `
  <p class="block-listing-results-count"><span id="block-listing-results-count"></span> ${ph.results}</p>
  <div class="block-listing-facets">
  </div>
  <div class="block-listing-sortby">
    <div class="block-listing-filter-button">${ph.filter}</div>
    <p class="block-listing-sort-button">${ph.sortBy} <span data-sort="group" id="block-listing-sortby">${ph.group}</span></p>
    <ul>
      <li data-sort="block">${ph.block}</li>
      <li data-sort="group">${ph.group}</li>
      <li data-sort="lastModified">${ph.newest}</li>
    </ul>
  </div>
  </div>
  <ul class="block-listing-results">
  </ul>`;
}

function getFacetHTML(ph) {
  return /* html */ `
  <div><div class="block-listing-filters">
    <div class="block-listing-filters-selected"></div>
    <p><button class="block-listing-filters-clear secondary">${ph.clearAll}</button></p>
    <div class="block-listing-filters-facetlist"></div>
  </div>
  <div class="block-listing-apply-filters">
    <button>${ph.seeResults}</button>
  </div></div>`;
}

export async function filterResults(config, facets = {}) {
  /* load index */
  let collection = 'blockInventory';
  await lookupPages([], collection);
  const listings = window.pageIndex[collection];

  /* simple array lookup */
  if (Array.isArray(config)) {
    const pathnames = config;
    return pathnames.map((path) => listings.lookup[path]).filter((e) => e);
  }

  /* setup config */
  const facetKeys = Object.keys(facets);
  const keys = Object.keys(config);
  const tokens = {};
  keys.forEach((key) => {
    tokens[key] = config[key].split(',').map((t) => t.trim());
  });

  /* filter */
  const results = listings.data.filter((row) => {
    const filterMatches = {};
    let matchedAll = keys.every((key) => {
      let matched = false;
      if (row[key]) {
        const rowValues = row[key].split(',').map((t) => t.trim());
        matched = tokens[key].some((t) => rowValues.includes(t));
      }
      filterMatches[key] = matched;
      return matched;
    });

    const isListing = () => !!row.publisher;

    /* facets */
    facetKeys.forEach((facetKey) => {
      let includeInFacet = true;
      Object.keys(filterMatches).forEach((filterKey) => {
        if (filterKey !== facetKey && !filterMatches[filterKey]) {
          includeInFacet = false;

          if (filterKey !== facetKey) {
            keys.every((key) => {
              let matched = false;

              if (row[key]) {
                const rowValues = row[key].split(',').map((t) => t.trim());
                matched = tokens[key].some((t) => rowValues.includes(t));

                if (matched) {
                  includeInFacet = true;
                }
                includeInFacet = false;
              }

              return matched;
            });
          }
        }
      });

      if (includeInFacet) {
        if (row[facetKey]) {
          const rowValues = row[facetKey].split(',').map((t) => t.trim());
          rowValues.forEach((val) => {
            if (facets[facetKey][val]) {
              facets[facetKey][val] += 1;
            } else {
              facets[facetKey][val] = 1;
            }
          });
        }
      }
    });
    return matchedAll;
  });
  return results;
}

export default async function decorate(block, blockName) {
  const ph = await fetchPlaceholders('/integrations');

  const addEventListeners = (elements, event, callback) => {
    elements.forEach((e) => {
      e.addEventListener(event, callback);
    });
  };

  const blockConfig = readBlockConfig(block);

  /* camelCase config */
  const config = {};
  Object.keys(blockConfig).forEach((key) => {
    config[toCamelCase(key)] = blockConfig[key];
  });

  let ctaBlockInfo = null;
  block.innerHTML = getBlockHTML(ph);

  const resultsElement = block.querySelector('.block-listing-results');
  const facetsElement = block.querySelector('.block-listing-facets');
  block.querySelector('.block-listing-filter-button').addEventListener('click', () => {
    block.querySelector('.block-listing-facets').classList.toggle('visible');
  });

  addEventListeners(
    [block.querySelector('.block-listing-sort-button'), block.querySelector('.block-listing-sortby p')],
    'click',
    () => {
      block.querySelector('.block-listing-sortby ul').classList.toggle('visible');
    },
  );

  const getSelectedFilters = () => [...block.querySelectorAll('input.block-inventory[type="checkbox"]:checked')];

  const hrvsCategoryGroups = [];

  const getHRVSVisibleCount = () => {
    const currentSelected = getSelectedFilters();
    return hrvsCategoryGroups.reduce((cnt, g) => {
      const isSelected = currentSelected.find(checked => checked.value === g.category);
      return (!currentSelected.length || isSelected) ? cnt + g.visibleCnt : cnt;
    }, 0);
  };

  const displayResults = async (results) => {
    resultsElement.innerHTML = '';
    let lastGroup = '';
    const isSortedByGroup = document.getElementById('block-listing-sortby')?.dataset?.sort === 'group';
    results.forEach(async (product, index) => {
      const blockContainer = document.createElement('div');
      blockContainer.classList = 'block-container';
      resultsElement.append(blockContainer);

      if (isSortedByGroup && product.group && product.group !== product.block &&
          lastGroup !== product.group) {
        if (lastGroup) addEndGroupLabel(lastGroup, resultsElement, blockContainer);
        addGroupLabel(product.group, blockContainer);
        if (index === results.length - 1) addEndGroupLabel(product.group, resultsElement);

        lastGroup = product.group;
      } else if (isSortedByGroup && lastGroup &&
                ((lastGroup !== product.group) || index === results.length - 1)) {
        const siblingContainer = index === results.length - 1 ? null : blockContainer;
        addEndGroupLabel(lastGroup, resultsElement, siblingContainer);

        lastGroup = '';
      }

      // Load the block fragment
      loadFragment(product.path).then(fragment => {
        blockContainer.append(fragment);
        addBlockLinks(blockContainer, product.block);
      });
    });

    window.setTimeout(() => {
      document.querySelectorAll('.block-listing-card-header h4').forEach(h4 => {
        if (h4.scrollWidth > h4.clientWidth) h4.title = h4.innerText;
      });
    }, 1000);
  };

  const runSearch = async (filterConfig = config) => {
    const facets = {
      category: {},
      group: {},
      block: {},
    };
    const results = await filterResults(filterConfig, facets);
    const sortBy = document.getElementById('block-listing-sortby')
      ? document.getElementById('block-listing-sortby').dataset.sort
      : 'group';

    if (sortBy && sortOptions(sortBy)) results.sort(sortOptions(sortBy));
    block.querySelector('#block-listing-results-count').textContent = results.length;
    displayResults(results, null);
    // eslint-disable-next-line no-use-before-define
    displayFacets(facets, filterConfig);
  };

  const createFilterConfig = () => {
    const filterConfig = { ...config };
    getSelectedFilters().forEach((checked) => {
      const facetKey = checked.name;
      const facetValue = checked.value;
      if (filterConfig[facetKey]) filterConfig[facetKey] += `, ${facetValue}`;
      else filterConfig[facetKey] = facetValue;
    });
    return filterConfig;
  };

  const sortList = block.querySelector('.block-listing-sortby ul');
  const selectSort = (selected) => {
    [...sortList.children].forEach((li) => li.classList.remove('selected'));
    selected.classList.add('selected');
    const sortBy = document.getElementById('block-listing-sortby');
    sortBy.textContent = selected.textContent;
    sortBy.dataset.sort = selected.dataset.sort;
    document.getElementById('block-listing-sortby').textContent = selected.textContent;
    block.querySelector('.block-listing-sortby ul').classList.remove('visible');
    runSearch(createFilterConfig());
  };

  sortList.addEventListener('click', (event) => {
    selectSort(event.target);
  });

  const displayFacets = (facets, filters) => {
    const rawFilters = getSelectedFilters().map((check) => check.value);
    const selected = config.category
      ? rawFilters.filter((filter) => filter !== config.category)
      : rawFilters;
    facetsElement.innerHTML = getFacetHTML(ph);

    addEventListeners(
      [
        facetsElement.querySelector('.block-listing-apply-filters button'),
        facetsElement.querySelector(':scope > div'),
        facetsElement,
      ],
      'click',
      (event) => {
        if (event.currentTarget === event.target) {
          block.querySelector('.block-listing-facets').classList.remove('visible');
        }
      },
    );

    const selectedFilters = block.querySelector('.block-listing-filters-selected');
    selected.forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'block-listing-filters-tag';
      span.textContent = tag;
      span.addEventListener('click', () => {
        document.getElementById(`block-listing-filter-${tag}`).checked = false;
        const filterConfig = createFilterConfig();

        runSearch(filterConfig);
      });
      selectedFilters?.append(span);
    });

    facetsElement.querySelector('.block-listing-filters-clear').addEventListener('click', () => {
      selected.forEach((tag) => {
        const filterElm = document.getElementById(`block-listing-filter-${tag}`);
        if (filterElm) filterElm.checked = false;
      });

      const filterConfig = createFilterConfig();

      runSearch(filterConfig);
    });

    /* list facets */
    const facetsList = block.querySelector('.block-listing-filters-facetlist');
    const facetKeys = Object.keys(facets);
    facetKeys.forEach((facetKey) => {
      const filter = filters[facetKey];
      const filterValues = filter ? filter.split(',').map((t) => t.trim()) : [];
      const facetValues = Object.keys(facets[facetKey]);
      facetValues.sort();
      if (facetValues.length) {
        const div = document.createElement('div');
        div.className = 'listing-facet';
        const h3 = document.createElement('h3');
        h3.innerHTML = ph[facetKey];
        div.append(h3);
        facetValues.forEach((facetValue) => {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.classList = 'block-inventory';
          input.value = facetValue;
          input.checked = filterValues.includes(facetValue);
          input.id = `block-listing-filter-${facetValue}`;
          input.name = facetKey;
          const label = document.createElement('label');
          label.setAttribute('for', input.id);
          label.textContent = `${facetValue} (${facets[facetKey][facetValue]})`;
          
          div.append(input, label);

          input.addEventListener('change', () => {
            const filterConfig = createFilterConfig();

            runSearch(filterConfig);
          });
        });
        facetsList.append(div);
      }
    });
  };

  runSearch(config);
}
