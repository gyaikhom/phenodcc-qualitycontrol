/*
 * Copyright 2012 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */

(function() {
    /* this is the global variable where we expose the public interfaces */
    if (typeof dcc === 'undefined')
        dcc = {};

    dcc.version = 'DCC_QC_VERSION', /* semantic version (set from pom.xml) */

        dcc.dateTimeFormat = d3.time.format('%Y-%m-%d %H:%M:%S'),
        dcc.dateFormat = d3.time.format("%e %B %Y, %A"),
        /* object that stores all of the visualisations */
        dcc.viz = {},
        /* state of the web application */
        dcc.state = {
        s: false /* is the specimen centric visualisation maximised */
    };

    /* map data context state to icon. Note that the name and order
     * of these string literals must match the name and precedence
     * defined by the consistent identifiers (cid) in phenodcc_qc.a_state. */
    var stateToIconMap = [
        'nodata', 'qcdone', 'dataadded', 'datachanged', 'dataremoved', 'hasissues'
    ],
    WILDTYPE_DATAPOINT_DISPLACEMENT = 20;

    /* the state Id comes from phenodcc_qc.data_context table */
    dcc.getStateIconName = function(record) {
        return record.get("numUnresolved") > 0 ?
            'hasissues' : stateToIconMap[record.get("stateId")];
    };
    dcc.getStateIcon = function(stateId, metaData, record) {
        var state = record.get("ur") > 0 ?
            'hasissues' : stateToIconMap[stateId];
        return  "<img src='resources/images/"
            + state + ".png'></img>";
    };

    /**
     * Returns the number of milliseconds it takes to execute a function.
     *
     * @param {Function} f Function to execute.
     */
    dcc.timedExec = function(f) {
        var start = new Date().getTime();
        f();
        return new Date().getTime() - start;
    };

    /**
     * Removes all white spaces from beginning and end. This extends the
     * String prototype.
     *
     * @description
     * Steven Levithan has made a comparison of various implementations.
     *
     * http://blog.stevenlevithan.com/archives/faster-trim-javascript
     */
    String.prototype.trim = function() {
        return this.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    };

    /**
     * Makes the first character of the string uppercase.
     */
    String.prototype.icap = function() {
        return this.substr(0, 1).toUpperCase() + this.substr(1);
    };

    /**
     * Returns a substring of the string object after discarding characters
     * from either the start, or the end.
     *
     * <p>If the supplied number of characters to be discarded is
     * less than 0, they are discarded at the end; otherwise, they are
     * discarded from the start of the string. <i>The original string is
     * left unmodified.</i></p>
     *
     * @param {Integer} nchars Number of characters to discard.
     *
     * @return {String} A substring with the remaining characters.
     */
    String.prototype.discard = function(nchars) {
        var length = this.length - nchars;
        return nchars < 0 ? this.substr(0, length)
            : this.substr(nchars, length);
    };

    /**
     * Returns the specified dimension for the supplied DOM element node.
     *
     * <p>We use the rendered dimension information available in
     * the DOM's style property. Only dimensions that can be measured using
     * pixel units are permitted as dimension type.</p>
     *
     * @param {Object} dom A DOM element node that has been selected with D3.
     * @param {String} type The type of the dimension required.
     *
     * @return {Integer|null} The height of the DOM node, or null if invalid
     *         dimension type.
     */
    function dcc_getNodeDimension(dom, type) {
        var value = null;
        switch (type) {
            case 'height':
            case 'width':
                /* remove 'px' suffix before integer parse */
                value = parseInt(dom.style(type).discard(-2));
                break;
            default:
        }
        return value;
    }

    /**
     * Returns a sorted array by merging the contents of the supplied
     * sorted arrays. <i>The supplied arrays are left unmodified.</i>
     *
     * @param {Object[]} f First sorted array.
     * @param {Object[]} s Second sorted array.
     * @param {Function} comparator A comparator function that takes two values
     *        <b>a</b> and <b>b</b> and returns <b>0</b> if <b>a = b</b>,
     *        <b>1</b> if <b>a > b</b>, or <b>-1</b> otherwise.
     *
     * @return {Object[]} The merged sorted array.
     */
    function dcc_mergeSortedArrays(f, s, comparator) {
        var sortedArray = [], i, j; /* the merged array and temp variables */
        i = j = 0;
        while (i < f.length && j < s.length)
            sortedArray.push(comparator(f[i], s[j]) === -1 ? f[i++] : s[j++]);
        while (i < f.length)
            s.push(f[i++]);
        while (j < s.length)
            s.push(s[j++]);
        return sortedArray;
    }

    /**
     * Calculates the quartile value for the given data set. We first calculate
     * the quartile interval for the integral values, and then do a linear
     * interpolation with the fractional part.
     *
     * @param {Integer} whichQuartile first, second or third.
     * @param {[Number | Object]} dataset Dataset of one-dimensional numerical
     *         values, or two-dimensional objects. In the later case, the column
     *         must be specified.
     * @param {String} column For two-dimensional data set, which column
     *         represents the measured dataset.
     *
     * @returns The quartile value.
     */
    function dcc_calculateQuartile(whichQuartile, dataset, column) {
        var k = (whichQuartile * .25 * (dataset.length - 1)) + 1,
            truncated = Math.floor(k),
            fractional = k - truncated,
            /* indexing begins at 0 */
            low = dataset[truncated - 1],
            high = dataset[truncated];

        /* if two-dimensional, retrieve column value */
        if (column) {
            low = low[column];
            high = high[column];
        }
        return low + (fractional * (high - low)); /* lerp */
    }

    /**
     * Returns the 1st and 3rd quartile indices inside a sorted data set
     * with the supplied number of items.
     *
     * <p>Since the <i>median</i> is the second quartile, and has already been
     * calculated elsewhere, we do not calculate it here.</p>
     *
     * @param {[Number]} data Sorted data set.
     * @param {String} column For two-dimensional data set, which column
     *         represents the measured dataset.
     *
     * @return {Object} An object that contains two properties, <b>q1</b> and
     *      <b>q3</b>, which are indeed indices inside the sorted data set.
     *      These indices, respectively, point to the first and third quartiles.
     */
    function dcc_getFirstAndThirdQuartiles(data, column) {
        return {
            'q1': dcc_calculateQuartile(1, data, column),
            'q3': dcc_calculateQuartile(3, data, column)
        };
    }

    /**
     * Calculates descriptive statistics for the supplied one-dimensional
     * data set (array of numerical values).
     *
     * <p>This implementation combines several algorithms and reuses common
     * values that have already been calculated by previous steps, thus
     * avoiding redundant loops.</p>
     *
     * @param {Object[]} dataset A one-dimensional array with data points.
     * @param {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b> and returns <b>0</b> if
     *        <b>a = b</b>, <b>1</b> if <b>a > b</b>, or <b>-1</b>
     *        otherwise. If <b>comparator = null</b>, the supplied array will
     *        be considered to be already sorted.
     *
     * @return {Object} An object that contains the statistical information.
     */
    function dcc_calculateArrayStatistics(dataset, comparator) {
        var statistics, size; /* statistics object and number of data points */
        if (dataset === null
            || !(dataset instanceof Array)
            || (size = dataset.length) < 1) {
            statistics = null;
        } else {
            var sum, max, min, mean, median,
                standardDeviation, standardError, quartile,
                distanceFromMean, isOdd,
                i, t; /* temp variables */

            if (comparator !== null)
                dataset.sort(comparator);
            max = min = sum = t = dataset[0];
            for (i = 1; i < size; ++i) {
                t = dataset[i];
                if (t > max)
                    max = t;
                if (t < min)
                    min = t;
                sum += t;
            }
            /* we now have maximum, minimum and sum of values */

            mean = sum / size;

            for (i = distanceFromMean = t = 0; i < size; ++i) {
                distanceFromMean = dataset[i] - mean;
                t += distanceFromMean * distanceFromMean;
            }

            standardDeviation = Math.sqrt(t / (size - 1));
            standardError = standardDeviation / Math.sqrt(size);

            /* calculate median */
            i = Math.floor(size * .5); /* find middle, or left of middle */
            isOdd = size & 1; /* is the number of data points odd? */

            /* we must make index adjustments since array indexing begins at 0.
             * when the number of data points is odd, median has already been
             * index adjusted due to flooring */
            median = isOdd ? dataset[i] : (dataset[i] + dataset[i - 1]) * .5;

            /* calculate quartiles: requires a minimum of 2 data-points */
            quartile = size > 1 ? dcc_getFirstAndThirdQuartiles(dataset) : null;

            statistics = {
                'sum': sum,
                'max': max,
                'min': min,
                'mean': mean,
                'median': median,
                'sd': standardDeviation,
                'se': standardError,
                'quartile': quartile
            };
        }
        return statistics;
    }


    /**
     * Calculates descriptive statistics for the supplied two-dimensional
     * data set where each row contains a one-dimensional subset of the data,
     * and each row is allowed to contain variable number of data points.
     *
     * @param {Object[][]} dataset A two-dimensional array with data points.
     * @param {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b> and returns <b>0</b> if
     *        <b>a = b</b>, <b>1</b> if <b>a > b</b>, or <b>-1</b>
     *        otherwise. If <b>comparator = null</b>, the supplied array will
     *        be considered to be already sorted.
     *
     * @return {Object} An object that contains the overall statistics for the
     *     entire dataset, and also multiple statistical information for each
     *     row of the data set. The structure of this object is as follows:
     *     {
     *         o: {max:, min: , sum:, mean:, median:, sd:, quartile: }
     *         r: [
     *            {max:, min: , sum:, mean:, median:, sd:, quartile: },
     *            {max:, min: , sum:, mean:, median:, sd:, quartile: }
     *            . . . // one stat object for each row in the data set
     *         ]
     *     }
     */
    function dcc_calculateRowStatistics(dataset, comparator) {
        var statistics, size, /* statistics object and number of data points */
            i, t; /* temp counter and variable */

        if (dataset === null
            || !(dataset instanceof Array)
            || (size = dataset.length) < 1) {
            statistics = null;
        } else {
            statistics = {
                r: [] /* object array of row statistics */
            };

            /* find statistics for each of the rows (row may not be sorted) */
            for (i = 0; i < size; ++i)
                statistics.r.push(dcc_calculateArrayStatistics(dataset[i],
                    comparator));
            /* the ith row of the dataset has now been sorted */

            /* merge all of the sorted rows into a sorted array */
            for (i = 1, t = dataset[0]; i < size; ++i)
                t = dcc_mergeSortedArrays(t, dataset[i], comparator);

            /* get statistics for the merged sorted array */
            statistics.o = dcc_calculateArrayStatistics(t, null);
        }
        return statistics;
    }

    /**
     * Calculates descriptive statistics for a specific column in the supplied
     * two-dimensional data set. In contrast to the function
     * <b>dcc_calculateRowStatistics()</b>, it is imperative that <i>all rows
     * must have the same size</i>.
     *
     * <p>This implementation combines several algorithms and reuses common
     * values that have already been calculated by previous steps, thus
     * avoiding redundant loops.</p>
     *
     * @param {Object[]} dataset A one-dimensional array with data points.
     * @param {String | Integer} column The column to process. This can either
     *        be a column index (starting at 0), or an attribute name.
     * @param {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b>, and the column index, or
     *        attribute, <b>c</b> and returns <b>0</b> if <b>a[c] = b[c]</b>,
     *        <b>1</b> if <b>a[c] > b[c]</b>, or <b>-1</b> otherwise.
     *        If <b>comparator = null</b>, the supplied array is already sorted.
     *
     * @return {Object} An object that contains the statistical information.
     */
    function dcc_calculateColumnStatistics(dataset, column, comparator) {
        var statistics, size; /* statistics object and number of data points */

        if (dataset === null
            || !(dataset instanceof Array)
            || (size = dataset.length) < 1) {
            statistics = null;
        } else {

            /* sum of values, maximum, minimum, mean, median,
             * population standard deviation, and quartile object */
            var sum, max, min, mean, median,
                standardDeviation, standardError, quartile,
                distanceFromMean, isOdd,
                t, i; /* temp variable and counter */

            sum = max = min = mean = median = 0;

            if (size > 0) {
                dataset.sort(comparator);

                max = min = sum = t = dataset[0][column];
                for (i = 1; i < size; ++i) {
                    t = dataset[i][column];
                    if (t > max)
                        max = t;
                    if (t < min)
                        min = t;
                    sum += t;
                }
                /* we now have maximum, minimum and sum of values */

                mean = sum / size;

                for (i = distanceFromMean = t = 0; i < size; ++i) {
                    distanceFromMean = dataset[i][column] - mean;
                    t += distanceFromMean * distanceFromMean;
                }

                standardDeviation = Math.sqrt(t / (size - 1));
                standardError = standardDeviation / Math.sqrt(size);

                /* calculate median */
                i = Math.floor(size * .5); /* find middle, or left of middle */
                isOdd = size & 1; /* is the number of data points odd? */

                /* we must make index adjustments since array indexing begins
                 * at 0. when the number of data points is odd, median has
                 * already been index adjusted due to flooring */
                median = isOdd ? dataset[i][column]
                    : (dataset[i][column] + dataset[i - 1][column]) * .5;

                /* calculate quartiles: requires a minimum of 2 data-points */
                quartile = size > 1 ?
                    dcc_getFirstAndThirdQuartiles(dataset, column) : null;

                statistics = {
                    'sum': sum,
                    'max': max,
                    'min': min,
                    'mean': mean,
                    'median': median,
                    'sd': standardDeviation,
                    'se': standardError,
                    'quartile': quartile
                };
            }
        }
        return statistics;
    }

    /**
     * Calculates the group statistics of the y-axis values, where the data
     * points have been grouped using the supplied property.
     *
     * @param {Object[]} dataset The data set, which is a one-dimensional
     *     array of objects with numerical data.
     * @param {String | Integer} groupKeyColumn The column property, or index,
     *     in the data-set that stores the key values with which to grouping the
     *     data points before calculating the statistics.
     * @param {String | Integer} valueColumn The column that stores the value
     *     for which we are making statistical calculations.
     *
     * @return Object that contains statistical information. The structure of
     *     this object is as follows:
     *
     *     [
     *         { k, c, d, s: {max, min, sum, mean, median, sd, quartile}},
     *         { k, c, d, s: {max, min, sum, mean, median, sd, quartile}},
     *            . . . // one stat object for each row in the data set
     *     ]
     *
     *     where, for each grouped data
     *
     *     k: the group key,
     *     c: number of items in the group
     *     d: the grouped measured values with same key
     *     max: maximum y-value
     *     min: minimum y-value
     *     sum: sum of the y-values
     *     mean: mean of the y-value
     *     median: median of the y-values
     *     sd: population standard deviation of the y-values for the group
     *     quartile: 1st and 2nd quartile points for the y-values
     */
    function dcc_calculateGroupedStatistics(dataset,
        groupKeyColumn, valueColumn) {
        var s = {/* statistics group object that will be returned */
            i: {},
            c: []
        },
        keyValue, measuredValue, currentGroupKeyValue,
            currentKeyGroup = [], i, size,
            valueComparator = dcc_getNumericalComparator();

        /* sort data in ascending value of key for efficient grouping */
        dataset.sort(dcc_getAttributeValueComparator(groupKeyColumn));

        i = 1;
        size = dataset.length;

        /* first key value defines the first group */
        keyValue = currentGroupKeyValue = dataset[0][groupKeyColumn];

        /* a key-to-index table for rapid reference */
        s.i[currentGroupKeyValue] = 0;

        /* start group with the first measured value */
        currentKeyGroup.push(dataset[0][valueColumn]);
        while (i < size) {
            keyValue = dataset[i][groupKeyColumn];
            measuredValue = dataset[i][valueColumn];

            /* still the same group? if so, value should join the group;
             * otherwise, process current group and start a new group */
            if (keyValue === currentGroupKeyValue)
                currentKeyGroup.push(measuredValue);
            else {
                /* no longer the same group! calculate statistical data
                 * for the current group and store the row statistics */
                s.c.push({
                    k: currentGroupKeyValue,
                    c: currentKeyGroup.length,
                    s: dcc_calculateArrayStatistics(currentKeyGroup,
                        valueComparator),
                    d: currentKeyGroup
                });

                /* we must start a new group. the current key value defines
                 * the new group; and the only member is its measured value */
                s.i[keyValue] = s.i[currentGroupKeyValue] + 1;
                currentGroupKeyValue = keyValue;
                currentKeyGroup = [measuredValue];
            }
            ++i;
        }

        /* calculate statistics for the unprocessed group */
        if (currentKeyGroup.length > 0)
            s.c.push({
                k: keyValue,
                c: currentKeyGroup.length,
                s: dcc_calculateArrayStatistics(currentKeyGroup,
                    valueComparator),
                d: currentKeyGroup
            });
        return s;
    }

    /**
     * Creates a frequency grid.
     *
     * @param {Integer} row Number of rows in the grid.
     * @param {Integer} col Number of columns in the grid.
     *
     * @returns {Array} Two-dimensional array frequency grid.
     */
    function dcc_createFrequencyGrid(row, col) {
        var i, j, freqGrid = [];
        for (i = 0; i < row; ++i) {
            freqGrid[i] = [];
            for (j = 0; j < col; ++j)
                freqGrid[i][j] = {
                    'm': {}, /* mutant frequency */
                    'b': {} /* wildtype/control frequency */
                };
        }
        return freqGrid;
    }

    /**
     * Prints the frequency grid.
     *
     * @param {Array} freqGrid Two-dimensional frequency grid.
     */
    function dcc_printFrequencyGrid(freqGrid) {
        var i, j;
        for (i = 0; i < 3; ++i)
            for (j = 0; j < 3; ++j)
                console.log(freqGrid[i][j]);
    }

    /**
     * Increments grid frequency for wildtype or mutant.
     *
     * @param {Array} freqGrid Two-dimensional frequency grid.
     * @param {Integer} row Grid row.
     * @param {Integer} col Grid column.
     * @param {Integer} category Measured category.
     * @param {String} type Type of datum (wildtype, or mutant).
     */
    function dcc_incrementCellFrequency(freqGrid, row, col, category, type) {
        var cell = freqGrid[row][col][type];
        if (cell[category] === undefined)
            cell[category] = 1; /* first specimen under this category */
        else
            cell[category] += 1;
    }

    /**
     * Processes a measurement datum. This will increment the
     * appropriate frequencies in the grid.
     *
     * @param {Array} freqGrid Two-dimensional frequency grid.
     * @param {Object} datum Measured categorical datum.
     */
    function dcc_processCategoricalDatum(freqGrid, datum) {
        /* genotype = 0 means wildtype datum */
        var type = datum.g === 0 ? 'b' : 'm', value = datum.v, temp;

        /* overall frequency */
        dcc_incrementCellFrequency(freqGrid, 2, 2, value, type);

        /* frequency by gender */
        temp = datum.z === 1 ? 0 : 1; /* grid column for zygosity */
        switch (datum.s) {
            case 0: /* female */
                dcc_incrementCellFrequency(freqGrid, 1, temp, value, type);
                dcc_incrementCellFrequency(freqGrid, 1, 2, value, type);
                break;

            case 1: /* male */
                dcc_incrementCellFrequency(freqGrid, 0, temp, value, type);
                dcc_incrementCellFrequency(freqGrid, 0, 2, value, type);
                break;

            default:
                break;
        }

        /* frequency by zygosity */
        switch (datum.z) {
            case 0: /* heterozygous */
                dcc_incrementCellFrequency(freqGrid, 2, 1, value, type);
                break;

            case 1: /* homozygous */
                dcc_incrementCellFrequency(freqGrid, 2, 0, value, type);
                break;

            default:
                break;
        }
    }

    /**
     * Calculates option percentages for wildtype or mutant in a cell.
     *
     * @param {Object} freq Object with category frequencies.
     *
     * @returns {Object} An object with category percentages.
     */
    function dcc_calculateFrequencyPercentages(freq) {
        var statistics = {}, total = 0, option;

        /* calculate total */
        for (option in freq)
            total += freq[option];

        /* calculate percentage */
        for (option in freq)
            statistics[option] = (freq[option] * 100.0) / total;

        return {
            't': total,
            's': statistics
        };
    }

    /**
     * Calculates the option percentages for each of the cells. These
     * percentages are then displayed as segment bars.
     *
     * @param {Array} freqGrid Two-dimensional frequency grid.
     */
    function dcc_calculateCategoryPercentages(freqGrid) {
        var i, j, freq;
        for (i = 0, j; i < 3; ++i) {
            for (j = 0; j < 3; ++j) {
                freq = freqGrid[i][j];
                freqGrid[i][j].sb = dcc_calculateFrequencyPercentages(freq.b);
                freqGrid[i][j].sm = dcc_calculateFrequencyPercentages(freq.m);
            }
        }
    }

    /**
     * Process categorical data into gender/zygosity grid.
     *
     * @param {[Object]} dataset Datatset with categorical measurements.
     * @returns Returns the frequency and percentage grid for wildtype/mutant
     *         and combinations of gender and zygosity. Using this grid, we can
     *         answer questions such as:
     *
     *         o What percentage of male specimens have option X?
     *         o What percentage of the wildtype male homozygous specimens have
     *           option X?
     *         o What percentage of the wildtype specimens have option X?
     */
    function dcc_processCategorical(dataset) {
        /* the following grid data structure captures frequencies for each of
         * the gender, zygosity and mutant combinations.
         *
         *               Homozygous   Heterozygous   Homozygous/Heterozygous
         *          Male   (0, 0)        (0, 1)              (0, 2)
         *        Female   (1, 0)        (1, 1)              (1, 2)
         *   Male/Female   (2, 0)        (2, 1)              (2, 2)
         *
         * And for each cell, we collect the wildtype (b) and mutant (m)
         * counts for each of the parameter options.
         */
        var freqGrid = dcc_createFrequencyGrid(3, 3);
        for (var i = 0, c = dataset.length; i < c; ++i)
            dcc_processCategoricalDatum(freqGrid, dataset[i]);
        dcc_calculateCategoryPercentages(freqGrid);
        return freqGrid;
    }

    /**
     * Draws an error bar (off one standard deviation) for a given data point.
     *
     * @param {String} id Identifier to use for the error bar group.
     * @param {Object} viz The visualisation object.
     * @param {Real} x Value of property <b>x</b> for the data point.
     * @param {Real} y Value of property <b>x</b> for the data point.
     * @param {Real} standardError Standard error of data set.
     * @param {Integer} width Width of the error bar in pixels.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_plotStandardError(id, viz, x, y, standardError, width) {
        var errorBarRootDom, /* groups all error bar components */
            svg = viz.state.n.s, visualisationScale = viz.scale,
            xScale = visualisationScale.x, yScale = visualisationScale.y,
            halfWidth = width * .5, /* half width: get bar offset from point */
            bottomLeftX, bottomLeftY, /* scaled bottom-left corner: screen coord */
            topRightX, topRightY; /* scaled top-right corner: screen coord */

        /* remove existing whisker plot group with the identifier */
        svg.selectAll('.ebar.' + id).remove();

        /* append a new series plot group */
        errorBarRootDom = svg.append('g').attr('class', 'ebar ' + id);

        /* calculate SVG screen coordinates for the vertical line and the
         * bottom-left and top-right corners */
        x = xScale(x);
        bottomLeftX = x - halfWidth,
            topRightX = x + halfWidth;

        bottomLeftY = yScale(y - standardError),
            topRightY = yScale(y + standardError);

        /* vertical line */
        dcc_line(errorBarRootDom, x, bottomLeftY, x, topRightY, 'v');

        /* min (low) */
        dcc_line(errorBarRootDom, bottomLeftX, bottomLeftY,
            topRightX, bottomLeftY, 'l');

        /* max (high) */
        dcc_line(errorBarRootDom, bottomLeftX, topRightY,
            topRightX, topRightY, 'h');
    }

    /**
     * Draws a whisker plot using the supplied statistical information.
     *
     * <p>To avoid overlapping the data points (if they are visible)
     * with the whisker plots, we displace the whisker plots to the
     * right of the data points.</p>
     *
     * @param {String} id Identifier to user for the whisker plot group.
     * @param {Object} viz The visualisatin object.
     * @param {Object} statistics The statistical information to use for plot.
     * @param {Real} groupKey Value used as the group key when calculating
     *        the supplied statistics.
     * @param {Integer} displacement Padding in pixels to use as displacement
     *        to the right of the x-value of the data point that is
     *        associated with the whisker plot.
     * @param {Integer} width Width of the whisker plot in pixels.
     * @param {String} cls The class to use for display style.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_plotBoxAndWhisker(id, viz, statistics, groupKey,
        displacement, width, cls) {
        var svg = viz.state.n.s, quartiles = statistics.quartile;
        if (!quartiles)
            return svg;

        var whiskerRootDom, visualisationScale = viz.scale,
            xScale = visualisationScale.x, yScale = visualisationScale.y,
            interQuartileRange, whiskerHeight, bottomLeftY, topRightY,
            halfWidth, bottomLeftX, topRightX, t;

        /* calculate y-coordinates of horizontal whiskers */
        if (viz.isActiveCtrl('use_iqr')) {
            interQuartileRange = quartiles.q3 - quartiles.q1;
            whiskerHeight = interQuartileRange * 1.5;
            bottomLeftY = yScale(quartiles.q1 - whiskerHeight);
            topRightY = yScale(quartiles.q3 + whiskerHeight);
        } else {
            bottomLeftY = yScale(statistics.min);
            topRightY = yScale(statistics.max);
        }

        /* remove existing whisker plot group with the identifier */
        svg.select('.whisker.' + cls + '.' + id).remove();

        /* append a new series plot group */
        whiskerRootDom = svg.append('g').attr('class',
            'whisker ' + id + ' ' + cls);

        /* screen x-coordinate of population giving the statistics */
        groupKey = xScale(groupKey);

        bottomLeftX = groupKey + displacement;
        topRightX = bottomLeftX + width;
        halfWidth = width * .5; /* half of box width */

        /* vertical line */
        t = bottomLeftX + halfWidth;
        dcc_line(whiskerRootDom, t, bottomLeftY, t, topRightY, 'v');

        /* +1.5 IQR */
        dcc_line(whiskerRootDom, bottomLeftX, bottomLeftY,
            topRightX, bottomLeftY, 'l');

        /* -1.5 IQR */
        dcc_line(whiskerRootDom, bottomLeftX, topRightY,
            topRightX, topRightY, 'h');

        /* box */
        t = yScale(quartiles.q3);
        dcc_rect(whiskerRootDom, bottomLeftX, t,
            width, yScale(quartiles.q1) - t);

        /* median */
        t = yScale(statistics.median);
        dcc_line(whiskerRootDom, bottomLeftX, t, topRightX, t, t, 'm');

        return svg;
    }

    /**
     * Draws a labelled horizontal line segment at the specified height.
     *
     * @param {Object} svg The parent D3 selected DOM element to render to.
     * @param {Integer} y Screen y-coordinate of the line.
     * @param {Integer} left Screen x-coordinate of the left end.
     * @param {Integer} right Screen x-coordinate of the right end.
     * @param {String} label Text to display as label.
     * @param {Integer} labelX Screen x-coordinate of label.
     * @param {Integer} labelY Screen y-coordinate of label.
     * @param {String} lineClass Class to use for the line.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_plotHorizontalLine(svg, y, left, right,
        label, labelX, labelY, lineClass) {
        var lineRootDom = svg.append('g').attr('class', lineClass);

        dcc_line(lineRootDom, left, y, right, y);

        /* should we show label? */
        if (label !== null && label.length > 0)
            dcc_text(lineRootDom, labelX, labelY, label);

        return svg;
    }

    /**
     * Draws an axis with line, ticks and label.
     *
     * <p>We assume that all of the parameters are valid (i.e., we do not check
     * if they are null or undefined.</p>
     *
     * @param {String} id Identifier to user for the whisker plot group.
     * @param {Object} viz The visualisation object.
     * @param {String} orientation Axis orientation (top, right, bottom, left).
     * @param {String} label Text to use as axis label.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_plotAxis(id, viz, orientation, label) {
        var svg = viz.state.n.v;
        /* remove existing axis with the identifier */
        svg.select('.' + id + '-axis').remove();

        /* if orientation is not provided, it means remove the axis */
        if (orientation === null)
            return viz;

        var axis = {},
            paddingFromRootDom = viz.dim.p,
            dim = viz.chart.dim, domHeight = dim.h, domWidth = dim.w,
            visualisationScale = viz.scale,
            xScale = visualisationScale.x, yScale = visualisationScale.y,
            halfPadding = paddingFromRootDom * .5,
            quarterPadding = halfPadding * .5,
            threeQuarterPadding = halfPadding + quarterPadding,
            valueRange,
            labelRotationAngle = 0, labelX, labelY,
            axisBoxTopLeftX, axisBoxTopLeftY;

        switch (orientation) {
            case 'bottom':
            case 'top':
                valueRange = xScale.range();
                axisBoxTopLeftX = 0;
                labelX = axisBoxTopLeftX + domWidth * .5;

                if (orientation[0] === 't') {
                    axisBoxTopLeftY = threeQuarterPadding;
                    labelY = axisBoxTopLeftY - (halfPadding + quarterPadding);
                } else {
                    axisBoxTopLeftY = domHeight - threeQuarterPadding;
                    labelY = axisBoxTopLeftY + halfPadding;
                }

                /* reusing variable valueRange */
                valueRange = d3.svg.axis()
                    .scale(xScale)
                    .orient(orientation);

                /* if the x-axis values are integral, format ticks as such */
                if (dcc.extjs.controller.ptype.xt === 'i') {
                    valueRange.tickFormat(d3.format("r"))
                        .tickValues(Object.keys(viz.state.sm.o.c.i));
                }

                break;

            case 'right':
            case 'left':
            default:
                valueRange = yScale.range();
                axisBoxTopLeftY = 0;
                labelY = domHeight * .5;
                if (orientation[0] === 'r') {
                    axisBoxTopLeftX = domWidth - threeQuarterPadding;
                    labelX = domWidth - (halfPadding + quarterPadding);
                    labelRotationAngle = 90;
                } else {
                    axisBoxTopLeftX = threeQuarterPadding;
                    labelX = quarterPadding;
                    labelRotationAngle = -90;
                }

                /* reusing variable valueRange */
                valueRange = d3.svg.axis().scale(yScale).orient(orientation);
        }

        /* append a new axis root */
        axis[id] = {};

        /* reusing variable domHeight */
        domHeight = svg.append('g').attr('class', id + '-axis');

        /* append line, ticks and values */
        axis.tick = domHeight.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' +
            axisBoxTopLeftX + ',' + axisBoxTopLeftY + ')')
            .call(valueRange);

        /* append label */
        axis.label = orientation[0] !== 'l' ? domHeight.append('text')
            .attr('text-anchor', 'middle')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('transform', 'rotate(' +
            labelRotationAngle + ',' + labelX + ',' + labelY + ' ' + ')')
            .text(label) : null;

        axis.root = domHeight;
        viz.state.n.a[id] = axis;

        return svg;
    }

    /**
     * Returns a linear scale for numerical data.
     *
     * @param {Real} domainLow Lowest value for the domain.
     * @param {Real} domainHigh highest value for the domain.
     * @param {Real} rangeLow Highest value for range.
     * @param {Real} rangeHigh Highest value for range.
     *
     * @return {Function} A scaling function that maps values from
     *         domain to range.
     */
    function dcc_getLinearScaler(domainLow, domainHigh, rangeLow, rangeHigh) {
        return d3.scale.linear()
            .domain([domainLow, domainHigh])
            .range([rangeLow, rangeHigh]);
    }

    /**
     * Returns a time scale for data/time.
     *
     * @param {Real} domainLow Lowest value for the domain.
     * @param {Real} domainHigh highest value for the domain.
     * @param {Real} rangeLow Highest value for range.
     * @param {Real} rangeHigh Highest value for range.
     *
     * @return {Function} A scaling function that maps values from
     *         domain to range.
     */
    function dcc_getTemporalScaler(domainLow, domainHigh,
        rangeLow, rangeHigh) {
        return d3.time.scale()
            .domain([domainLow, domainHigh])
            .range([rangeLow, rangeHigh]);
    }

    /**
     * Draws the day and night visualisation.
     *
     * @param {Object} svg The parent D3 selected DOM element to render to.
     * @param {Real} nightStart Screen coordinate for start of night.
     * @param {Real} nightEnd Screen coordinate for end of night.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_plotDayAndNightBand(svg, nightStart, nightEnd) {
        var t;

        /* value of nightStart should be less than that of nightEnd */
        if (nightStart > nightEnd) {
            t = nightStart;
            nightStart = nightEnd;
            nightEnd = t;
        }

        t = svg.viz.scale.y.range();

        dcc_rect(svg, nightStart, t[1],
            nightEnd - nightStart, t[0] - t[1], 'day-night');
        return svg;
    }

    /**
     * Draws the overall statistical information for the entire data set.
     *
     * @param {Object} viz The visualisation object.
     * @param {Object} statistics The statistical information to use for plot.
     * @param {Integer} [padding] Label padding (pixels) from line right-end.
     * @param {Boolean} isBaseline Is the plot for wildtype data?
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_plotStatistics(viz, statistics, padding, isBaseline) {
        var svg = viz.state.n.s,
            scale = viz.scale, yScale = scale.y,
            xRange = scale.x.range(), labelX,
            meanY = yScale(statistics.mean), medianY = yScale(statistics.median),
            offsetMeanY = 0, offsetMedianY = 0;

        /* prevent mean and median labels from overlapping */
        meanY > medianY ? offsetMeanY = 10 : offsetMedianY = 10;

        /* label displacement from end of line */
        if (padding)
            labelX = xRange[1] + padding;

        if (viz.isActiveCtrl('mean')) {
            if (isBaseline)
                dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    '', labelX, meanY + offsetMeanY, 'wildtype-mean');
            else
                dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'mean', labelX, meanY + offsetMeanY, 'mean');
        }

        if (viz.isActiveCtrl('median')) {
            if (isBaseline)
                dcc_plotHorizontalLine(svg, medianY, xRange[0], xRange[1],
                    '', labelX, medianY + offsetMedianY, 'wildtype-median');
            else
                dcc_plotHorizontalLine(svg, medianY, xRange[0], xRange[1],
                    'median', labelX, medianY + offsetMedianY, 'median');
        }

        if (viz.isActiveCtrl('quartile')) {
            if (statistics.quartile !== null) {
                /* reusing variable meanY */
                meanY = yScale(statistics.quartile.q1);

                if (isBaseline)
                    dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        '', labelX, meanY, 'wildtype-q1');
                else
                    dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        'Q1', labelX, meanY, 'q1');

                /* reusing variable meanY */
                meanY = yScale(statistics.quartile.q3);
                if (isBaseline)
                    dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        '', labelX, meanY, 'wildtype-q3');
                else
                    dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        'Q3', labelX, meanY, 'q3');
            }
        }

        if (viz.isActiveCtrl('max')) {
            /* reusing variable meanY */
            meanY = yScale(statistics.max);
            if (isBaseline)
                dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    '', labelX, meanY + offsetMeanY, 'wildtype-max');
            else
                dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'max', labelX, meanY + offsetMeanY, 'max');
        }

        if (viz.isActiveCtrl('min')) {
            /* reusing variable meanY */
            meanY = yScale(statistics.min);
            if (isBaseline)
                dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    '', labelX, meanY + offsetMeanY, 'wildtype-min');
            else
                dcc_plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'min', labelX, meanY + offsetMeanY, 'min');
        }

        return svg;
    }

    /**
     * Displays a crosshair with horizontal and vertical line segments that
     * intersects at the mouse pointer position. The crosshair consists of
     * four parts, so that the intersection points does not coincide with
     * the mouse pointer coordinate. This prevents events from misfiring.
     *
     * @param {Object} viz The visualisation object.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_renderCrosshair(viz) {
        var svg = viz.state.n.v, xhair;

        /* group cross hair components and hide it during creation */
        svg.selectAll('.xhair').remove();
        xhair = svg.append('g').attr('class', 'xhair');

        /* crosshair horizontal line segment */
        xhair.horizontalLeft = dcc_line(xhair, 0, 0, 0, 0);
        xhair.horizontalRight = dcc_line(xhair, 0, 0, 0, 0);

        /* crosshair vertical line segment */
        xhair.verticalTop = dcc_line(xhair, 0, 0, 0, 0);
        xhair.verticalBottom = dcc_line(xhair, 0, 0, 0, 0);

        svg.xhair = xhair;
        return svg;
    }

    /**
     * Reference to the information box.
     */
    var dcc_InformationBox, /* initialised when visualisation is created */
        dcc_InformationBoxOffset = 15, /* pixel displacement from mouse pointer */
        dcc_InformationBoxWidth, dcc_InformationBoxHeight;

    /**
     * Relocates the information box which contains the data point details
     * relative to the current mouse pointer position.
     *
     * @param {Object} bmc Bounded mouse coordinates and bounding region.
     */
    function dcc_relocateInformationBox(bmc) {
        var x = bmc.boundedCoordX, y = bmc.boundedCoordY,
            hx = bmc.rangeHighX, ly = bmc.rangeLowY;

        dcc_InformationBoxWidth =
            dcc_getNodeDimension(dcc_InformationBox, 'width');

        dcc_InformationBoxHeight =
            dcc_getNodeDimension(dcc_InformationBox, 'height');

        /* the label is positioned relative to the crosshair center.
         * the pointer crosshair divides the visualisation into four
         * quadrants. if possible, we should always show the label
         * inside the 4th quadrant (since it is easier to read the
         * label as we move the crosshair). However, if the label
         * cannot be displayed in full, we must choose an
         * alternative quadrant to display the information */
        x = x + dcc_InformationBoxWidth > hx
            ? x - dcc_InformationBoxWidth
            : x + dcc_InformationBoxOffset;

        y = y + dcc_InformationBoxHeight > ly
            ? y - dcc_InformationBoxHeight - dcc_InformationBoxOffset
            : y + dcc_InformationBoxOffset;

        /* move the information box to new position */
        dcc_InformationBox
            .style('left', (x + bmc.originX) + 'px')
            .style('top', (y + bmc.originY) + 'px')
            .classed('hidden', false);
    }

    /**
     * Gets the bounded mouse coordinate.
     *
     * @param {Object} viz Visualisation object which has coordinate bounds.
     */
    function dcc_getBoundedMouseCoordinate(viz) {
        var dom = document.getElementById('specimen-centric-chart'),
            dim = dom.getBoundingClientRect(),
            screenMousePointerCoordinate = d3.mouse(dom),
            mouseX = screenMousePointerCoordinate[0],
            mouseY = screenMousePointerCoordinate[1],
            scale = viz.scale, xScale = scale.x, yScale = scale.y,
            xRange = xScale.range(), yRange = yScale.range(),
            rangeLowX = xRange[0], rangeHighX = xRange[1],
            rangeLowY = yRange[0], rangeHighY = yRange[1],
            boundedCoordX, boundedCoordY, isInside;

        /* x-coordinate increases left to right */
        boundedCoordX = mouseX < rangeLowX ? rangeLowX
            : mouseX > rangeHighX ? rangeHighX : mouseX;

        /* y-coordinate increases top to bottom */
        boundedCoordY = mouseY > rangeLowY ? rangeLowY
            : mouseY < rangeHighY ? rangeHighY : mouseY;

        /* is the mouse coordinate inside the bounded region */
        isInside = boundedCoordX === mouseX && boundedCoordY === mouseY;

        return {
            'isInside': isInside,
            'originX': dim.left,
            'originY': dim.top,
            'boundedCoordX': boundedCoordX,
            'boundedCoordY': boundedCoordY,
            'mouseX': mouseX,
            'mouseY': mouseY,
            'rangeLowX': rangeLowX,
            'rangeHighX': rangeHighX,
            'rangeLowY': rangeLowY,
            'rangeHighY': rangeHighY
        };
    }

    /**
     * Hides the information box.
     * @param {Object} viz Visualisation object associated with information box.
     */
    function dcc_hideInformationBox(viz) {
        /* hide data point information box if visible */
        if (viz && viz.state && viz.state.d === true) {
            dcc_InformationBox.classed('hidden', true);
            viz.state.d = false;
            viz.state.measurementId = -1;
            viz.state.animalId = -1;
        }
    }

    /**
     * Attaches an event handler which gets activated when the mouse moves
     * on top of the main SVG canvas. This will relocate the the infobox
     * near the mouse pointer, and also update the position of the crosshair.
     *
     * @param {Object} viz The visualisation object.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_svgMouseventHandler(viz) {
        var svg = viz.state.n.v, xhair = svg.xhair;
        svg.on('mouseover',
            function() {
                if (viz.isActiveCtrl('cross_hair')) {
                    xhair.style('opacity', 1);
                }
                dcc_hideInformationBox(viz);
            })
            .on('mouseout',
            function() {
                if (viz.isActiveCtrl('cross_hair')) {
                    xhair.style('opacity', 0);
                }
            })
            .on('mousemove',
            function() {
                var bmc = dcc_getBoundedMouseCoordinate(viz);

                if (viz.isActiveCtrl('cross_hair')) {
                    /* position horizontal line */
                    xhair.horizontalLeft
                        .attr('x1', bmc.rangeLowX)
                        .attr('x2', bmc.boundedCoordX - 5)
                        .attr('y1', bmc.boundedCoordY)
                        .attr('y2', bmc.boundedCoordY);
                    xhair.horizontalRight
                        .attr('x1', bmc.boundedCoordX + 5)
                        .attr('x2', bmc.rangeHighX)
                        .attr('y1', bmc.boundedCoordY)
                        .attr('y2', bmc.boundedCoordY);

                    /* position vertical line */
                    xhair.verticalTop
                        .attr('x1', bmc.boundedCoordX)
                        .attr('x2', bmc.boundedCoordX)
                        .attr('y1', bmc.rangeHighY)
                        .attr('y2', bmc.boundedCoordY - 5);
                    xhair.verticalBottom
                        .attr('x1', bmc.boundedCoordX)
                        .attr('x2', bmc.boundedCoordX)
                        .attr('y1', bmc.boundedCoordY + 5)
                        .attr('y2', bmc.rangeLowY);
                }
            });
        return svg;
    }

    /**
     * Selects the supplied data point for the supplied category.
     *
     * @param {Object} state Visualisation object state.
     * @param {Object} datapoint Data point to select.
     */
    function dcc_selectDatapoint(state, datapoint) {
        state.q[datapoint.m] = datapoint;
    }

    /**
     * Checks if the supplied data point is a member of the supplied category.
     *
     * @param {Object} state Visualisation object state.
     * @param {Object} datapoint Data point to select.
     *
     * @return {Boolean} If member <b>true</b>; otherwise, <b>false</b>.
     */
    function dcc_datapointIsSelected(state, datapoint) {
        return state.q[datapoint.m];
    }

    /**
     * Removes the supplied data point from the supplied category.
     *
     * @param {Object} state Visualisation object state.
     * @param {Object} datapoint Data point to select.
     */
    function dcc_removeDatapointFromSelection(state, datapoint) {
        delete state.q[datapoint.m];
    }


    /**
     * When we attach a selector, we want the brush to be enabled outside the
     * range that corresponds to the domain defined by the data set. This means
     * that we must create a scale which allows us to extend beyoung the normal
     * range, so that the brush can start and end outside the allowed range. To
     * do this, we will be adding extra padding. Since this padding is define
     * by an integral number of pixels, we must use the inverse of the current
     * scale to create the extended scale.
     *
     * @param {Object} viz The visualisation object.
     * @returns {Object} boxScale Scale to be used by the box selector,
     *         which covers the entire visualisation chart.
     */
    function dcc_getVisualisationScaler(viz) {
        var boxScale = {}, visualisationDimension = viz.chart.dim,
            width = visualisationDimension.w, height = visualisationDimension.h;
        boxScale.x = dcc_getLinearScaler(0, width, 0, width);
        boxScale.y = dcc_getLinearScaler(0, height, 0, height);
        return boxScale;
    }

    /**
     * Returns a screen coordinate convertor, which ensures that the
     * bounding coordinates of the box selector extent always lies in the
     * region defined by the sceen coordinates (range) of the data point values.
     *
     * @param {Array} xRange Low and high screen x-coordinates of data region.
     * @param {Array} yRange Low and high screen y-coordinates of data region.
     * @returns {Function} Convertor function that takes extent and returns
     *         new extent that is inside the data region.
     */
    function dcc_getSelectorExtentConvertor(xRange, yRange) {
        var xrl = xRange[0], xrh = xRange[1],
            yrl = yRange[1], yrh = yRange[0];

        return function(extent) {
            /* extent bounds: t - top, b - bottom, l - left, r - right */
            var tlx = extent[0][0], brx = extent[1][0],
                tly = extent[0][1], bry = extent[1][1];

            /* the offset by 1 pixel ensures that the box selector extent
             * always intersects the data region boundary for it to effectively
             * contain any data point. Otherwise, boundary data points will
             * always fall inside the extent, even when the extent itself is
             * outside the data region. */
            extent[0][0] = tlx < xrl ? xrl - 1 : tlx > xrh ? xrh + 1 : tlx;
            extent[0][1] = tly < yrl ? yrl - 1 : tly > yrh ? yrh + 1 : tly;
            extent[1][0] = brx < xrl ? xrl - 1 : brx > xrh ? xrh + 1 : brx;
            extent[1][1] = bry < yrl ? yrl - 1 : bry > yrh ? yrh + 1 : bry;

            return extent;
        };
    }

    /**
     * Checks if the data point is inside the extent of the selector box.
     * 
     * @param {Object} datapoint Datapoint to check against bounding box.
     * @param {Object} extent The bounding box of the box selector.
     */
    function isInsideBoxSelector(datapoint, extent) {
        return extent[0][0] <= datapoint.sx
            && datapoint.sx <= extent[1][0]
            && extent[0][1] <= datapoint.sy
            && datapoint.sy <= extent[1][1];
    }

    /**
     * Mark all data points inside the box for selection.
     * 
     * @param {Object} viz Visualisation object associated with selector.
     * @param {Object} svg SVG node that contains the data points.
     * @param {Object} selector The box selector.
     * @param {Object} extent The bounding box of the box selector.
     */
    function markForSelection(viz, svg, selector, extent) {
        svg.selectAll(selector)
            .classed('to-select', function(d) {
            return isInsideBoxSelector(d, extent)
                && !dcc_datapointIsSelected(viz.state, d)
                ? true : false;
        });
    }

    /**
     * Mark all data points inside the box for removal.
     * 
     * @param {Object} svg SVG node that contains the data points.
     * @param {Object} selector The box selector.
     * @param {Object} extent The bounding box of the box selector.
     */
    function markForRemoval(svg, selector, extent) {
        svg.selectAll(selector)
            .classed('to-remove', function(d) {
            return isInsideBoxSelector(d, extent) ? true : false;
        });
    }

    /**
     * Attaches a rectangular data point selector, or deselector.
     *
     * <p>The box selector operates under two modes, as follows:
     * <ul>
     * <li>If the 'highlight selected data points' is enabled, all of the data
     * points selected using the box selector will be removed from the set of
     * selected data points.
     * </li>
     * <li>On the other hand, if the 'highlight selected data points' is
     * disabled, then all of the data points selected using the box selector
     * will be added to the set of selected data points. If the data points
     * were already selected, they will continue to exist in this set.
     * </li>
     * </ul>
     * </p>
     *
     * @param {Object} viz The visualisation object.
     * @param {String} mode If <b>select</b>, use selection mode; otherwise,
     *        use deselect mode (when selected points have been highlighted).
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_attachBoxSelector(viz, mode) {
        var scale = viz.scale, xScale = scale.x, yScale = scale.y,
            xRange = xScale.range(), yRange = yScale.range(),
            isSelect = mode === 'select' ? true : false,
            box = viz.state.n.b, svg = isSelect ? viz.state.n.v : viz.state.n.h;

        svg.selectAll('.box-selector').remove();
        var k = svg.append('g').attr('class', 'box-selector'),
            boxScale = dcc_getVisualisationScaler(viz),
            convertExtent = dcc_getSelectorExtentConvertor(xRange, yRange);

        box.on('brushstart', function(p) {
            if (box.data !== p) {
                k.call(box.clear());
                box.x(boxScale.x).y(boxScale.y).data = p;
            }
        })
            .on('brush', function() {
            var e = convertExtent(box.extent()),
            selectorType =  dcc.dataContext.gid === 0 ? 'rect' : 'circle';
            if (isSelect) {
                if (viz.isActiveCtrl('highlight') &&
                    viz.isActiveCtrl('high_point'))
                    markForSelection(viz, svg, '.series.highlighted ' +
                    selectorType, e);

                if (viz.isActiveCtrl('show_all') &&
                    viz.isActiveCtrl('all_point'))
                    markForSelection(viz, svg, '.all-points ' +
                    selectorType, e);
            } else {
                markForRemoval(svg, 'circle', e);
            }
        })
            .on('brushend', function() {
            if (isSelect) {
                svg.selectAll('.to-select')
                    .classed('selected', function(d) {
                    dcc_selectDatapoint(viz.state, d);
                    return true;
                })
                    .classed('to-select', false);
            } else {
                svg.selectAll('.highlight-selection circle.to-remove')
                    .attr('class', function(d) {
                    dcc_removeDatapointFromSelection(viz.state, d);
                })
                    .remove();
            }
            k.call(box.clear());
        });
        k.call(box.x(boxScale.x).y(boxScale.y));
        return svg;
    }

    /**
     * Draws a series using a onedimensional array of (x, y) values.
     *
     * @param {String} id Series identifier.
     * @param {Object[]} dataset A two dimensional array with the numerical
     *     data points.
     * @param {Function} getUnscaled Function that returns unscaled <b>x</b>
     *     and <b>y</b> values from the dataset.
     * @param {Object} viz The visualisation object.
     * @param {Object} svg The SVG DOM node to render to.
     * @param {Function} dataPointClickHandler Event handler for click events
     *     over a series data point.
     * @param {Function} dataPointOnMouseoverHandler Event handler for events
     *     when mouse hovers over a series data point.
     * @param {Function} dataPointOnMousemoveHandler Event handler for events
     *     when mouse moves over a series data point.
     * @param {Boolean} displayDataPoint If <b>true</b>, display data points.
     * @param {Boolean} displaySeriesPolyline If <b>true</b>, display the
     *     series polyline.
     * @param {String} shape What shape to use for data point.
     * @param {Integer} size A single measure for the size of the shape in
     *     pixels; for instance, radius of the data point circle; or length of
     *     the side of a square.
     *
     * @return {Object} The modified DOM element.
     */
    function dcc_plotSeries(id, dataset, getUnscaled, viz, svg,
        dataPointOnMouseoverHandler, dataPointOnMousemoveHandler,
        dataPointClickHandler, displayDataPoint, displaySeriesPolyline,
        shape, size) {
        var seriesRootDom, i, polylinePoints,
            xScale = viz.scale.x, yScale = viz.scale.y,
            dataPoint, dataPointArray, t;

        /* remove existing series plot group with the identifier */
        svg.select('.series.' + id).remove();

        /* append a new series plot group */
        seriesRootDom = svg.append('g').attr('class', 'series ' + id);

        /* prepare points for SVG polyline using series data points */
        polylinePoints = '';
        dataPointArray = [];
        for (i = 0; i < dataset.length; ++i) {
            t = getUnscaled(dataset[i]);

            /* don't plot point if y-value is undefined */
            if (t.y === null)
                continue;
            dataPoint = {
                m: t.m, /* the measurement id */
                a: t.a, /* animal id */
                x: t.x, /* unscaled values */
                y: t.y,
                sx: xScale(t.x), /* scaled values */
                sy: yScale(t.y)
            };
            dataPointArray.push(dataPoint);
            polylinePoints += dataPoint.sx + ',' + dataPoint.sy + ' ';
        }

        /* draw SVG polyline through all series data points */
        if (displaySeriesPolyline)
            seriesRootDom.append('polyline').attr('points', polylinePoints);

        /* draw the series data points */
        var db = seriesRootDom.selectAll('circle').data(dataPointArray);

        db.exit().remove(); /* remove existing points */

        /* show data points? */
        if (displayDataPoint) {
            switch (shape) {
                case 'c': /* draw circle */
                    db.enter()
                        .append('circle')
                        .attr('mid', function(d) {
                        return d.m;
                    })
                        .attr('aid', function(d) {
                        return d.a;
                    })
                        .attr('r', size)
                        .attr('cx',
                        function(d) {
                            return d.sx;
                        })
                        .attr('cy',
                        function(d) {
                            return d.sy;
                        })
                        .attr('class', function(d) {
                        return viz.state.q[d.m] ? 'selected' : null;
                    })
                        .on('mouseup', function() {
                        d3.event.stopPropagation();
                    })
                        .on('mousedown', function() {
                        d3.event.stopPropagation();
                    })
                        .on('mouseover', dataPointOnMouseoverHandler)
                        //.on('mouseout', dataPointOnMouseoutHandler)
                        .on('mousemove', dataPointOnMousemoveHandler)
                        .on('click', dataPointClickHandler);
                    break;

                case 's': /* draw square */
                    db.enter()
                        .append('rect')
                        .attr('mid', function(d) {
                        return d.m;
                    })
                        .attr('aid', function(d) {
                        return d.a;
                    })
                        .attr('width', size * 2)
                        .attr('height', size * 2)
                        .attr('x',
                        function(d) {
                            return d.sx - size +
                                (dcc.dataContext.gid === 0 ? 0 :
                                WILDTYPE_DATAPOINT_DISPLACEMENT);
                        })
                        .attr('y',
                        function(d) {
                            return d.sy - size;
                        })
                        .attr('class', function(d) {
                        return viz.state.q[d.m] ? 'selected' : null;
                    })
                        .on('mouseup', function() {
                        d3.event.stopPropagation();
                    })
                        .on('mousedown', function() {
                        d3.event.stopPropagation();
                    })
                        .on('mouseover', dataPointOnMouseoverHandler)
                        //.on('mouseout', dataPointOnMouseoutHandler)
                        .on('mousemove', dataPointOnMousemoveHandler)
                        .on('click', dataPointClickHandler);
                    break;
            }
        }
        return;
    }

    /**
     * Prepares the data-of-birth for display.
     *
     * @param {String} dob Date of birth value from server.
     * @returns {String} Valid date-of-birth information.
     */
    function dcc_prepareDateOfBirth(dob) {
        if (dob === null || dob.length === 0) {
            dob = "Unknown value";
        } else {
            try {
                dob = dcc.dateFormat(new Date(dob));
            } catch (e) {
                dob = "Invalid value";
            }
        }
        return dob;
    }

    /**
     * Prepares the sex of the specimen for display.
     *
     * @param {String} sex Sex of the specimen from server.
     * @returns {String} Valid sex information.
     */
    function dcc_prepareSex(sex) {
        if (sex === null || sex.length === 0) {
            sex = "Invalid";
        } else {
            if (sex.length === 1) {
                try {
                    switch (parseInt(sex)) {
                        case 0:
                            sex = "Female";
                            break;
                        case 1:
                            sex = "Male";
                            break;
                        default:
                            sex = "Invalid";
                    }
                } catch (e) {
                    sex = "Invalid";
                }
            } else {
                sex = "Invalid";
            }
        }
        return sex;
    }

    /**
     * Prepares the zygosity of the specimen for display.
     *
     * @param {Integer} zygosity Zygosity of the specimen from server.
     * @returns {String} Valid zygosity information.
     */
    function dcc_prepareZygosity(zygosity) {
        if (zygosity === undefined) {
            zygosity = "Invalid";
        } else {
            switch (zygosity) {
                case 0:
                    zygosity = "Heterozygous";
                    break;
                case 1:
                    zygosity = "Homozygous";
                    break;
                case 2:
                    zygosity = "Hemizygous";
                    break;
                default:
                    zygosity = "Invalid";
            }
        }
        return zygosity;
    }

    /**
     * Prepares specimen litter information for display.
     *
     * @param {String} litter Litter information from server.
     * @returns {String} Valid litter information.
     */
    function dcc_prepareLitter(litter) {
        if (litter === null || litter.length === 0) {
            litter = "Unknown value";
        }
        return litter;
    }

    /**
     * Prepares specimen name for display.
     *
     * @param {String} name Specimen name from server.
     * @returns {String} Valid specimen name.
     */
    function dcc_prepareSpecimenName(name) {
        if (name === null || name.length === 0) {
            name = "Unknown value";
        }
        return name;
    }

    /**
     * Prepares the data point 'on hover' information.
     *
     * @param {Object} data Specimen data.
     * @param {Object} datapoint Contsins measurement id and animal id,
     *     which is retrieved from the visualisation.
     */
    function dcc_prepareInfo(data, datapoint) {
        if (data === null)
            return "<h3>Server did not return valid data</h3>";

        var dob = dcc_prepareDateOfBirth(data.dob),
            animalName = dcc_prepareSpecimenName(data.animalName),
            litter = dcc_prepareLitter(data.litter),
            x, ptype = dcc.extjs.controller.ptype,
            info = '<hr><ul><li><b>Name:</b> ' + animalName + '</li>'
            + '<li><b>DOB:</b> ' + dob + '</li>'
            + '<li><b>Litter:</b> ' + litter + '</li></ul>';

        if (ptype.t === 'nominal') {
            info = '<b>Category:</b> ' + datapoint.v + '</br>' + info;
        } else {
            x = datapoint.x;
            if (ptype.xt === 'd') {
                if (typeof x !== 'Date')
                    x = new Date(x);
                x = dcc.dateFormat(x);
            }
            info = '<b>X:</b> ' + x + '<br><b>Y:</b> ' + datapoint.y + info;
        }

        return info;
    }

    /**
     * Returns a generic event handler that is activated when the mouse
     * hovers over a data point.
     *
     * @param {Object} viz The visualisation object.
     */
    function dcc_getDatapointOnMouseOverHandler(viz) {
        return function(datapoint) {
            d3.event.stopPropagation();
            dcc_relocateInformationBox(dcc_getBoundedMouseCoordinate(viz));
            d3.json('rest/specimens/extjs/' + datapoint.a
                + '?u=' + dcc.roles.uid
                + '&s=' + dcc.roles.ssid,
                function(data) {
                    if (data.success === true) {
                        var datum = data.specimens[0],
                            iconCls = dcc_prepareSex(datum.sex) + '-'
                            + dcc_prepareZygosity(datum.homozygous);

                        dcc_InformationBox
                            .html(dcc_prepareInfo(datum, datapoint))
                            .attr('class', iconCls);

                        /* update visualisation state */
                        viz.state.d = true;
                        viz.state.measurementId = datapoint.m;
                        viz.state.animalId = datapoint.a;
                    }
                });
        };
    }

    /**
     * Returns a generic event handler that is activated when the mouse
     * moves over a data point.
     *
     * @param {Object} viz The visualisation object.
     */
    function dcc_getDatapointOnMouseMoveHandler(viz) {
        return function(datapoint) {
            d3.event.stopPropagation();
            dcc_relocateInformationBox(dcc_getBoundedMouseCoordinate(viz));
        };
    }

    /**
     * Returns a generic event handler that is activated when a data point
     * is clicked.
     *
     * @param {Object} viz The visualisation object.
     */
    function dcc_getDatapointOnMouseClickHandler(viz) {
        return function(datapoint) {
            d3.event.stopPropagation();
            var circle = d3.select(this),
                selectDataPoints = viz.state.q;

            /* we use the object associative array as a hash map */
            if (selectDataPoints[datapoint.m])
                delete selectDataPoints[datapoint.m];
            else
                selectDataPoints[datapoint.m] = {
                    m: datapoint.m,
                    a: datapoint.a,
                    x: datapoint.x,
                    y: datapoint.y
                };

            /* update selection visuals */
            if (circle.classed('selected'))
                circle.classed('selected', false);
            else
                circle.classed('selected', true);
        };
    }

    /**
     * Returns a comparator function.
     *
     * @return {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b> and returns <b>0</b> if
     *        <b>a = b</b>, <b>1</b> if <b>a > b</b>, or <b>-1</b> otherwise.
     *        If <b>comparator = null</b>, the supplied array is already sorted.
     */
    function dcc_getNumericalComparator() {
        return function(a, b) {
            return a === b ? 0 : a > b ? 1 : -1;
        };
    }

    /**
     * Returns a comparator function which takes a column property/index.
     *
     * @param {String | Integer} k The column property/index for the value.
     *
     * @returns {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b>, and the column index, or
     *        attribute, <b>c</b> and returns <b>0</b> if <b>a[c] = b[c]</b>,
     *        <b>1</b> if <b>a[c] > b[c]</b>, or <b>-1</b> otherwise.
     *        If <b>comparator = null</b>, the supplied array is already sorted.
     */
    function dcc_getAttributeValueComparator(k) {
        return function(a, b) {
            return a[k] === b[k] ? 0 : a[k] > b[k] ? 1 : -1;
        };
    }

    /**
     * Groups measured items into series points using a key, and calculates
     * the group statistics for each of the series.
     *
     * @param {Object[]} dataset The data set, which is a one-dimensional array
     *      of objects with numerical data.
     * @param {String | Integer} keyColumn The column property/index inside a
     *      data-point to use as key for grouping.
     * @param {String | Integer} xColumn The column property/index that gives
     *      the x-value.
     * @param {String | Integer} yColumn The column property/index that gives
     *      the y-value.
     * @param {String | Integer} measurementIdColumn The column property/index
     *      that gives the unique measurement identifier.
     * @param {String | Integer} animalIdColumn The column property/index
     *      that gives the unique animal identifier.
     *
     * @return Object that contains statistical information. The structure of
     *     this object is as follows:
     *
     *     [
     *         { k, c, d, s: {max, min, sum, mean, median, sd, quartile}},
     *         { k, c, d, s: {max, min, sum, mean, median, sd, quartile}},
     *            . . . // one stat object for each row in the data set
     *     ]
     *
     *     where, for each grouped data
     *
     *     k: the group key,
     *     c: number of items in the group
     *     d: group data as coordinate pairs (x, y) where y is the value
     *     max: maximum y-value
     *     min: minimum y-value
     *     sum: sum of the y-values
     *     mean: mean of the y-value
     *     median: median of the y-values
     *     sd: standard deviation of the y-values
     *     quartile: 1st and 2nd quartile points for the y-values
     */
    function dcc_calculateGroupedSeriesStatistics(dataset, keyColumn,
        xColumn, yColumn, animalIdColumn, measurementIdColumn) {
        var s = {
            i: {}, /* key-to-index lookup table */
            r: [] /* row statistics */
        }, /* statistics group object that will be returned */
        currentKey, currentGroupKey, currentKeyGroup = [],
            currentMeasuredValueX, currentMeasuredValueY,
            i, size, xValueComparator;

        /* sort data in ascending value of key for efficient grouping */
        dataset.sort(dcc_getAttributeValueComparator(keyColumn));

        i = 1;
        size = dataset.length;

        /* first key value defines the first group */
        currentGroupKey = dataset[0][keyColumn];

        xValueComparator = dcc_getAttributeValueComparator(xColumn);

        /* a key-to-index table for rapid reference */
        s.i[currentGroupKey] = 0;

        /* start group with the first measured value */
        currentKeyGroup.push({
            m: dataset[0][measurementIdColumn],
            a: dataset[0][animalIdColumn],
            x: dataset[0][xColumn],
            y: dataset[0][yColumn],
            s: dataset[0].s /* sex */
        });

        while (i < size) {
            currentKey = dataset[i][keyColumn];
            currentMeasuredValueX = dataset[i][xColumn];
            currentMeasuredValueY = dataset[i][yColumn];
            if (currentKey === currentGroupKey)
                /* still the same group; value joins group */
                currentKeyGroup.push({
                    m: dataset[i][measurementIdColumn],
                    a: dataset[i][animalIdColumn],
                    x: currentMeasuredValueX,
                    y: currentMeasuredValueY,
                    s: dataset[i].s, /* sex */
                    z: dataset[i].z /* zygosity */
                });
            else {
                /* no longer the same group! calculate statistical data
                 * for the current group and store the row statistics. Since
                 * we want to use the group points for series plotting against
                 * the x-values, they must be sorted by the x-values */
                s.r.push({
                    k: currentGroupKey,
                    c: currentKeyGroup.length,
                    s: dcc_calculateColumnStatistics(currentKeyGroup, 'y'),
                    d: currentKeyGroup.sort(xValueComparator)
                });

                /* we must start a new group. the current key value defines
                 * the new group; and the only member is its measured value */
                s.i[currentKey] = s.i[currentGroupKey] + 1;
                currentGroupKey = currentKey;
                currentKeyGroup = [{
                        m: dataset[i][measurementIdColumn],
                        a: dataset[i][animalIdColumn],
                        x: currentMeasuredValueX,
                        y: currentMeasuredValueY,
                        s: dataset[i].s, /* sex */
                        z: dataset[i].z /* zygosity */
                    }];
            }
            ++i;
        }

        /* calculate statistics for the unprocessed group */
        if (currentKeyGroup.length > 0) {
            s.r.push({
                k: currentKey,
                c: currentKeyGroup.length,
                s: dcc_calculateColumnStatistics(currentKeyGroup, 'y'),
                d: currentKeyGroup.sort(xValueComparator)
            });
        }

        return s;
    }

    /**
     * Accepts a one-dimensional array of measurements and calculates the
     * various statistics required, while also preparing the data for plotting.
     *
     * @param {Object} dataset The data set, which is a one-dimensional array
     *     of objects.
     * @param {String | Integer} keyColumn The column property/index inside a
     *      data-point to use as key for grouping.
     * @param {String | Integer} xColumn The column property/index that gives
     *      the x-value.
     * @param {String | Integer} yColumn The column property/index that gives
     *      the y-value.
     * @param {String | Integer} measurementIdColumn The column property/index
     *      that gives the unique measurement identifier.
     * @param {String | Integer} animalIdColumn The column property/index
     *      that gives the unique animal identifier.
     *
     * @return An object that contains various statistics and the data in
     *         the appropriate format required for plotting. The returned
     *         object has the following structure:
     *
     *         {
     *             c: { // group by x-values
     *                 i:, // x-value-to-group statistics object index
     *                 c: [ // group statistics when grouped using x-value
     *                 {
     *                     k: group key: which is the x-value
     *                     c: group size
     *                     d: [ y1, y2, . . . ] // y-values with same x-value
     *                     s: {
     *                         min:
     *                         max:
     *                         sum:
     *                         mean:
     *                         median:
     *                         sd:
     *                         quartile: {
     *                             q1:
     *                             q3:
     *                         }
     *                     }
     *                 },
     *                 . . . // one object for every unique x-value
     *                 ]
     *             },
     *             o: { // overall statistics
     *                 x: { // limited statistics for the x-value
     *                     min:
     *                     max:
     *                 },
     *                 y { // full statistics for the y-value
     *                     min:
     *                     max:
     *                     sum:
     *                     mean:
     *                     median:
     *                     sd:
     *                     quartile: {
     *                         q1:
     *                         q3:
     *                     }
     *                 }
     *             },
     *             r: { // group by animal Id
     *                 i:, // animalId-to-group statistics object index
     *                 r: [ // group statistics when grouped using animalId
     *                 {
     *                     k: group key: which is the animal Id
     *                     c: group size
     *                     d: [ y1, y2, . . . ] // y-values with same x-value
     *                     s: {
     *                         min:
     *                         max:
     *                         sum:
     *                         mean:
     *                         median:
     *                         sd:
     *                         quartile: {
     *                             q1:
     *                             q3:
     *                         }
     *                     }
     *                 },
     *                 . . . // one object for every unique animal Id
     *                 ]
     *             }
     *         }
     *
     */
    function dcc_prepareDatasetForPlotting(dataset, keyColumn, xColumn,
        yColumn, animalIdColumn, measurementIdColumn) {

        if (!dataset || dataset.length < 1)
            return null;

        /* the statistics and formatted data */
        var s = {
            o: {}, /* overall statistics: all for y-values, min/max for x */
            c: {}, /* column statistics where data is grouped by x-values */
            r: {} /* row statistics where data is grouped by animal id */
        }; /* temp variables */

        /* we first calculate the overall statistics for the y-values. Since
         * calculation of the median and quartiles require sorting the entire
         * data-set using the 'y' value, we have to do this separately. */
        s.o.y = dcc_calculateColumnStatistics(dataset, yColumn,
            dcc_getAttributeValueComparator(yColumn));

        /* next, we find the column statistics of the data where the
         * measurements are grouped by their x-values */
        s.c = dcc_calculateGroupedStatistics(dataset, xColumn, yColumn);

        /* next, we find the row statistics of the data where the
         * measurements are grouped by their animal identifiers. This also
         * prepares the required data-set for series plotting against
         * animal identifier. */
        s.r = dcc_calculateGroupedSeriesStatistics(dataset, keyColumn, xColumn,
            yColumn, animalIdColumn, measurementIdColumn);

        /* finally, we derive the minimum and maximum x-values required for
         * generating the x-axis and scales. We use the column statistics
         * because the measurements have already been grouped by x-values
         * and these have already been sorted (due to the grouping). We could
         * have calculated the overall statistics for the x-values, however,
         * since only min and max are required, it will be an overkill */
        s.o.x = {};
        s.o.x.min = s.c.c[0].k; /* the key of the first column statistics */
        s.o.x.max = s.c.c[s.c.c.length - 1].k; /* key of last column stat */

        return s;
    }

    /**
     * Calculates all of the descriptive statistics separated by gender.
     *
     * @param {Object} dataset The data set, which is a one-dimensional array
     *     of objects that contain both gender.
     * @param {String | Integer} keyColumn The column property/index inside a
     *      data-point to use as key for grouping.
     * @param {String | Integer} xColumn The column property/index that gives
     *      the x-value.
     * @param {String | Integer} yColumn The column property/index that gives
     *      the y-value.
     * @param {String | Integer} measurementIdColumn The column property/index
     *      that gives the unique measurement identifier.
     * @param {String | Integer} animalIdColumn The column property/index
     *      that gives the unique animal identifier.
     */
    function dcc_calculateStatistics(dataset, keyColumn, xColumn,
        yColumn, animalIdColumn, measurementIdColumn) {
        if (!dataset)
            return null;
        var i, c, datapoint, maleData = [], femaleData = [];
        for (i = 0, c = dataset.length; i < c; ++i) {
            datapoint = dataset[i];
            if (datapoint.s)
                maleData.push(datapoint);
            else
                femaleData.push(datapoint);
        }
        return {
            'o': dcc_prepareDatasetForPlotting(dataset, keyColumn, xColumn,
                yColumn, animalIdColumn, measurementIdColumn),
            'm': dcc_prepareDatasetForPlotting(maleData, keyColumn, xColumn,
                yColumn, animalIdColumn, measurementIdColumn),
            'f': dcc_prepareDatasetForPlotting(femaleData, keyColumn, xColumn,
                yColumn, animalIdColumn, measurementIdColumn)
        };
    }

    /**
     * Returns the correct statistics object depending on the control setting.
     *
     * @param {Object} viz Th visualisation object.
     * @param {Boolean} forMutant If true, return mutant statistics,
     *         otherwise, return wildtype statistics.
     */
    function dcc_getStatistics(viz, forMutant) {
        var statistics = null, temp = forMutant ? viz.state.sm : viz.state.sb;
        if (temp) {
            var showMale = viz.isActiveCtrl('all_male'),
                showFemale = viz.isActiveCtrl('all_female');
            statistics = showMale ? showFemale ? temp.o : temp.m
                : showFemale ? temp.f : null;
        }
        return statistics;
    }

    /**
     * Toggles a control between on or off.
     *
     * @param {Object} domNode The DOM node that represents the control.
     */
    function dcc_toggleControlState(domNode) {
        if (domNode.classed('on')) {
            domNode.classed('on', false);
            domNode.classed('off', true);
        } else {
            domNode.classed('on', true);
            domNode.classed('off', false);
        }
    }

    /**
     * Shows or hides a control sub-group that belongs to a control.
     *
     * <p>All of the controls that belong to a main control with identifier,
     * say 'statistics', must be enclosed inside a DOM node with
     * identifier, 'statistics_options'. This is a convention that we use
     * for simplicity.</p>
     *
     * @param {String} control The main control which controls the subgroup.
     * @param {Object} viz The visualisation object that is associatd
     *     with the control.
     */
    function dcc_processControlSubgroup(control, viz) {
        var node;
        switch (control) {
            case 'statistics':
            case 'show_all': /* show all measurements */
            case 'highlight': /* highlight the current specimen */
                node = d3.select('#' + control + '_options');
                if (viz.state.o[viz.type] & viz.omask[control]) {
                    node.style('display', 'block');
                } else {
                    node.style('display', 'none');
                }
                break;
            default:
        }
    }

    /**
     * Returns a click event-handler for a visualisation control.
     *
     * @param {String} control The control that will own the event-handler.
     * @param {Object} viz The visualisation object that is associatd
     *     with the control.
     */
    function dcc_getControlOnClickHandler(control, viz) {
        return function(node) {
            viz.state.o[viz.type] ^= viz.omask[control];
            dcc.control_options = viz.state.o;
            dcc_processControlSubgroup(control, viz);
            if (node === undefined) {
                node = d3.select(this);
            }
            dcc_toggleControlState(node);
            viz.refresh();
        };
    }

    /**
     * Adds a control item into the set of visualisation control interface.
     *
     * @param {Object} domNode The D3 selected DOM node to append new
     *      control specific DOM nodes to.
     * @param {Object} control The control data (type, label, etc.).
     * @param {Object} viz Visualisation object that owns the control.
     */
    function dcc_addControlToPanel(domNode, control, viz) {
        var temp;

        /* TODO: following is a hack; will be replaced when control panel
         * facilities are improved. This hides the 'Show wildtype' control
         * if we are viewing wildtype data. */
        if (dcc.dataContext.gid === 0 && control.m === 'wildtype')
            return;

        switch (control.t) {
            case 'vspace':
                domNode.append('div').attr('class', 'vspace');
                break;

            case 'hspace':
                domNode.append('div').attr('class', 'hspace');
                break;

            case 'checkbox':
                domNode.append('div')
                    .attr('id', control.i)
                    .attr('class',
                    viz.state.o[viz.type] & viz.omask[control.m] ? 'on' : 'off')
                    .text(control.l)
                    .on('click', dcc_getControlOnClickHandler(control.m, viz));

                dcc_addControlSubGroupToPanel(domNode, control.c, viz);
                break;

            case 'fieldset':
                temp = domNode.append('div')
                    .attr('id', control.i)
                    .attr('class', 'vopt-group');

                temp.append('div')
                    .attr('class', 'vopt-group-label')
                    .text(control.l);

                dcc_addControlSubGroupToPanel(temp, control.c, viz);
                break;

            case 'radioset':
                temp = domNode.append('div')
                    .attr('id', control.i)
                    .attr('class', 'vopt-group');

                temp.append('div')
                    .attr('class', 'vopt-group-label')
                    .text(control.l);

                dcc_addControlSubGroupToPanel(temp, control.c, viz);
                break;

            default:
        }
    }

    /**
     * Adds a control sub-group.
     *
     * @param {Object} domNode The D3 selected DOM node to append new
     *      control specific DOM nodes to.
     * @param {Object} spec The control specification. The set of controls,
     *      their types, organisation, hierarchy etc.
     * @param {Object} viz Visualisation object that owns the control.
     */
    function dcc_addControlSubGroupToPanel(domNode, spec, viz) {
        for (var i in spec)
            dcc_addControlToPanel(domNode, spec[i], viz);
    }

    var numberOfSelectedDatapoints, numberOfSelectedAnimals;

    /**
     * Prepares the measurement identifiers for the selected data points so that
     * they can be communicated to the server.
     *
     * @param {String} vizId Identifier for the visualisation.
     *
     * @returns An array of measurements identifiers.
     */
    function dcc_prepareSelectedDatapoints(vizId) {
        var viz = dcc.viz[vizId], i, selectedDatapoints,
            measurementIdentifiers = [];
        if (viz) {
            selectedDatapoints = viz.state.q;
            for (i in selectedDatapoints)
                measurementIdentifiers.push(selectedDatapoints[i].m);
        }
        return measurementIdentifiers;
    }
    
    /**
     * Prepares animal ids for retrieving details.
     * 
     * @param {String} vizId Identifier for the visualisation.
     *
     * @returns {String} Comma separated list of animal ids.
     */
    function dcc_prepareSelectedAnimals(vizId) {
        var viz = dcc.viz[vizId], i, selectedDatapoints,
            selectedAnimals = {}, animalIds = '';
        if (viz) {
            selectedDatapoints = viz.state.q;
            
            /* we only want unique animal ids, so hash them out */
            numberOfSelectedDatapoints = 0;
            for (i in selectedDatapoints) {
                selectedAnimals[selectedDatapoints[i].a] = 1;
                ++numberOfSelectedDatapoints;
            }
            
            numberOfSelectedAnimals = 0;
            for (i in selectedAnimals) {
                animalIds += i + ',';
                ++numberOfSelectedAnimals;
            }
        }
        return animalIds;
    }

    /**
     * Prepares animal details for includion in the description text area.
     * 
     * @param {Array} animals Array of specimens.
     * @returns {String} Animal details to be filled in text area.
     */
    function dcc_prepareAnimalDetails(animals) {
        var i, animal, s = '\n\nANIMAL DETAILS:\n' +
            'Animal id, Animal name, Litter, Genotype, Cohort id\n';
        for (i in animals) {
            animal = animals[i];
            s += animal.animalId + ', ' +
                animal.animalName + ', ' +
                animal.litter + ', ' +
                animal.genotype + ', ' +
                animal.cohortId + '\n';
        }
        return s;
    }

    /**
     * Displays the raise issue dialog. We firts retrieve details of all the
     * animals that were selected before the raise issue button was pressed.
     * This is then filled in the description text area.
     * 
     * @param {Object} dialog The dialog box, so that it can be closed.
     * @param {String} animalDetails Animal details to put inside the
     *     description text area.
     */
    function dcc_showRaiseIssueDialog(dialog, animalDetails) {
        var formContainer = d3.select('#form-container'), textarea, label;
        formContainer.append('div')
            .attr('class', 'form-label')
            .text('Title:');

        formContainer.append('input')
            .attr('id', 'issue-title')
            .attr('type', 'text')
            .attr('name', 'title')
            .attr('placeholder', 'Enter here a brief title that summarises the issue')
            .attr('class', 'form-input-text');

        label = 'Description: <span style="color:' +
            (numberOfSelectedDatapoints > 0 ? 'green' : 'red') + '">(' +
            numberOfSelectedDatapoints + ' datapoints selected';
        if (numberOfSelectedDatapoints > 0)
            label += ' for ' + numberOfSelectedAnimals + ' specimens)</span>';
        else
            label += ')</span>';
        formContainer.append('div')
            .attr('class', 'form-label')
            .html(label);
       
        textarea = formContainer.append('textarea')
            .attr('id', 'issue-description')
            .attr('rows', 18)
            .attr('cols', 96)
            .attr('name', 'detail')
            .attr('placeholder', 'Provide here a detail description of the issue.')
            .attr('class', 'form-textarea');
        if (animalDetails !== undefined)
            textarea.html(animalDetails);

        var buttonGroup = formContainer.append('div')
            .attr('class', 'form-button-group');

        buttonGroup.append('div')
            .attr('class', 'form-label')
            .text('Priority:');

        buttonGroup.append('select')
            .attr('id', 'issue-priority')
            .attr('class', 'form-label')
            .html('<option value="1">Low</option><option value="2">Medium</option><option value="3">High</option>');

        buttonGroup.append('div')
            .attr('class', 'submit-button')
            .text('Submit issue')
            .on('click', function() {
            var t = document.getElementById('issue-title'),
                d = document.getElementById('issue-description'),
                p = document.getElementById('issue-priority'),
                issue = new Ext.create('PhenoDCC.model.Issue', {
                "title": t.value,
                "description": d.value,
                "priority": p.value,
                "status": 0, /* cid for new in phenodcc_qc.issue_status */
                "contextId": dcc.dataContext.id,
                "lid": dcc.dataContext.lid,
                "raisedBy": dcc.roles.uid,
                "assignedTo": 1,
                "datapoints": dcc_prepareSelectedDatapoints('specimen')
            });
            issue.save({
                callback: function() {
                    dialog.close();
                    dcc.extjs.controller.onPipelineChange();
                }
            });
        });

        buttonGroup.append('div')
            .attr('class', 'cancel-button')
            .text('Cancel')
            .on('click', function() {
            dialog.close();
        });
    }

    /**
     * Creates a dialog with form fields for raising an issue.
     */
    function dcc_renderRaiseIssueDialog() {
        if (dcc.roles.uid === 0) {
            alert('Sorry, you must be logged in to create an issue.');
            return;
        }
        if (dcc.roles.qc === false) {
            alert('Sorry, you do not have privileges to create an issue.');
            return;
        }

        var dialog = Ext.create('Ext.window.Window', {
            title: 'Raise an issue',
            height: 550,
            width: 750,
            modal: true,
            layout: 'fit',
            resizable: false,
            items: {
                xtype: 'container',
                border: false,
                bodyPadding: 15,
                html: '<div id="form-container"></div>'
            }
        }).show();

        d3.json("rest/specimens/extjs/selected"
            + '?u=' + dcc.roles.uid
            + '&s=' + dcc.roles.ssid
            + '&ids=' + dcc_prepareSelectedAnimals('specimen'),
            function(data) {
                if (data.success === true && data.total > 0)
                    dcc_showRaiseIssueDialog(dialog,
                    dcc_prepareAnimalDetails(data.specimens));
                else
                    dcc_showRaiseIssueDialog(dialog);
            });
    }

    function dcc_maximiseVisualisation() {
        var a = Ext.getCmp('data-view-specimens-qc-panel'),
            b = Ext.getCmp('gene-strain-procedure-parameter-container'),
            bOn = function() {
            b.un('collapse', bOn);
        },
            aOn = function() {
            a.un('collapse', aOn);
            b.on('collapse', bOn);
            b.collapse();
        };
        if (a && !a.getCollapsed()) {
            if (b && !b.getCollapsed())
                a.on('collapse', aOn);
            a.collapse();
        } else {
            if (b && !b.getCollapsed())
                b.collapse();
        }
    }

    function dcc_minimiseVisualisation() {
        var a = Ext.getCmp('data-view-specimens-qc-panel'),
            b = Ext.getCmp('gene-strain-procedure-parameter-container'),
            aOn = function() {
            a.un('expand', aOn);
        },
            bOn = function() {
            b.un('expand', bOn);
            a.on('expand', aOn);
            a.expand();
        };
        if (b && b.getCollapsed()) {
            if (a && a.getCollapsed())
                b.on('expand', bOn);
            b.expand();
        } else {
            if (a && a.getCollapsed())
                a.expand();
        }
    }

    /**
     * Create a toolbar for controlling visualisation and raising issues.
     *
     * @param {Object} container D3 selected DOM node that contains the
     *     visualisation.
     * @param {Object} viz The visualisation object.
     */
    function dcc_renderButtonsPanel(container, viz) {
        var buttonGroup = container.append('div')
            .attr('id', 'viz-control-buttons')
            .attr('class', 'button-group'),
            controller = dcc.extjs.controller;

        buttonGroup.append('div')
            .attr('class', 'viz-button-qcdone')
            .attr('title', 'Mark this as QC done')
            .on('click', function() {
            var context = dcc.contextState;
            if (context.get("numResolved") !== context.get("numIssues"))
                alert('There are unresolved issue. These must be resolved '
                    + 'before the data context can be marked as QC done.');
            else
                d3.text('rest/datacontexts/qcdone/' + dcc.dataContext.id
                    + '?u=' + dcc.roles.uid + '&s=' + dcc.roles.ssid)
                    .header("Content-type", "application/json")
                    .post(null,
                    function(error, text) {
                        dcc.dataContext.qid = -1;
                        dcc.dataContext.qeid = 'null';
                        viz.state.q = {};
                        viz.refresh();
                        controller.onPipelineChange();
                    });
        });

        buttonGroup.append('div')
            .attr('class', 'viz-button-qcdonegrp')
            .attr('title', 'Mark related parameters as QC done')
            .on('click', function() {
            d3.text('rest/datacontexts/qcdonegrp/' + dcc.dataContext.id
                + '?u=' + dcc.roles.uid + '&s=' + dcc.roles.ssid)
                .header("Content-type", "application/json")
                .post(null,
                function(error, text) {
                    viz.state.q = {};
                    viz.refresh();
                    controller.onPipelineChange();
                });
        });

        buttonGroup.append('div')
            .attr('class', 'viz-button-raise')
            .attr('title', 'Raise an issue with selected data points')
            .on('click', function() {
            dcc_renderRaiseIssueDialog();
        });

        buttonGroup.append('div')
            .attr('class', 'viz-button-clear')
            .attr('title', 'Clear data point selection')
            .on('click', function() {
            viz.state.q = {};
            if (viz.isActiveCtrl('selected')) {
                var ctrl = d3.select('#show_selected_data_points');
                ctrl.on('click')(ctrl);
                dcc.control_options = viz.state.o;
            }
            viz.refresh();
        });

        buttonGroup.append('div')
            .attr('class', 'viz-button-maximise')
            .attr('title', 'Maximise visualisation')
            .on('click', dcc_maximiseVisualisation);

        buttonGroup.append('div')
            .attr('class', 'viz-button-minimise')
            .attr('title', 'Minimise visualisation')
            .on('click', dcc_minimiseVisualisation);
    }

    /**
     * Creates the control interface for the visualisation type.
     *
     * @param {Object} container D3 selected DOM node that contains the
     *     visualisation.
     * @param {Object} viz The visualisation object.
     */
    function dcc_renderVisualisationControlInterface(container, viz) {
        var specification = dcc_control_spec[viz.type].control;
        container.select('#specimen-centric-viz-control').remove();
        var vizControls = container.append('div')
            .attr('id', 'specimen-centric-viz-control');

        /* create the visualisation toolbar */
        dcc_renderButtonsPanel(vizControls, viz);

        /* creates the highest level control group */
        dcc_addControlSubGroupToPanel(vizControls.append('div')
            .attr('class', 'vopt-controls'), specification, viz);

        /* show or hide the control subgroups, as required */
        var o = ['statistics', 'show_all', 'highlight'], i;
        for (i = 0; i < o.length; ++i)
            dcc_processControlSubgroup(o[i], viz);
    }

    function dcc_getOverallBaselineStatisticsBothGenders(stat) {
        var statistics = undefined;
        if (typeof stat === undefined || !stat) {
            console.log('No wildtype statistics...');
        } else {
            if (typeof stat.o === undefined || !stat.o) {
                console.log('No overall wildtype statistics...');
            } else {
                stat = stat.o;
                if (typeof stat.o === undefined || !stat.o) {
                    console.log('No overall wildtype statistics for both genders...');
                } else {
                    statistics = stat.o;
                }
            }
        }
        return statistics;
    }

    /**
     * Adds milliseconds to a date.
     * 
     * @param {Date} date Date object.
     * @param {Integer} milliseconds Number of milliseconds to add.
     * @returns {Date} New date.
     */
    function addMillisecondstoDate(date, milliseconds) {
        return new Date(date.getTime() + milliseconds);
    }

    /**
     * Adds days to a date.
     * 
     * @param {Date} date Date object.
     * @param {Integer} days Number of days to add.
     * @returns {Date} New date.
     */
    function addDaysToDate(date, days) {
        return addMillisecondstoDate(date, days * 86400000);
    }

    /**
     * Prepare effective x-scale for use in plotting.
     * 
     * NOTE:
     * If all datapoints have the same x-value, artificially expand the
     * scale so that the data points are in the middle. Note that we need
     * four columns for female, female(WT), male and male(WT).
     * 
     * @param {String} type Data type of the x-values.
     * @param {Object} minX Minimum x-value for the data set.
     * @param {Object} maxX Maximum x-value for the data set.
     * @param {Integer} width Width of the visualisation (in pixels).
     * @param {Integer} padding Padding around plottable region (in pixels).
     */
    function prepareEffectiveXscale(type, minX, maxX, width, padding) {
        if (type === 'd') {
            if (minX.getTime() === maxX.getTime()) {
                minX = addDaysToDate(minX, -2); /* go back two days */
                maxX = addDaysToDate(maxX, 2); /* go forward two days */
            }
            return dcc_getTemporalScaler(minX, maxX, padding, width - padding);
        } else {
            if (minX === maxX) {
                minX -= 2;
                maxX += 2;
            }
            return dcc_getLinearScaler(minX, maxX, padding, width - padding);
        }
    }

    /**
     * Prepare effective y-scale for use in plotting.
     * 
     * NOTE:
     * If all datapoints have the same y-value, artificially expand the
     * scale so that the data points are in the vertical middle.
     * 
     * @param {Object} minY Minimum y-value for the data set.
     * @param {Object} maxY Maximum y-value for the data set.
     * @param {Integer} height Height of the visualisation (in pixels).
     * @param {Integer} padding Padding around plottable region (in pixels).
     */
    function prepareEffectiveYscale(minY, maxY, height, padding) {
        if (minY === maxY) {
            minY -= 2;
            maxY += 2;
        }
        return dcc_getLinearScaler(minY, maxY, height - padding, padding);
    }

    /**
     * Creates a series plot.
     *
     * @param {Object} viz The visualisation object.
     */
    dcc.seriesPlot = function(viz) {
        var containerDomNode = viz.state.n.v,
            visualisationDimension = viz.chart.dim, padding = viz.dim.p,
            width = visualisationDimension.w, height = visualisationDimension.h,
            mutantStatistics = viz.state.sm.o.o, /* overall mutant statistics */
            minX = mutantStatistics.x.min,
            minY = mutantStatistics.y.min,
            maxX = mutantStatistics.x.max,
            maxY = mutantStatistics.y.max,
            baselineStatistics = viz.state.sb,
            ptype = dcc.extjs.controller.ptype;

        /* if wildtype is to be displayed, and if the statistics are defined */
        if (dcc.dataContext.gid !== 0 && viz.isActiveCtrl('wildtype')) {
            baselineStatistics =
                dcc_getOverallBaselineStatisticsBothGenders(baselineStatistics);
            if (baselineStatistics !== undefined) {
                if (minX > baselineStatistics.x.min)
                    minX = baselineStatistics.x.min;
                if (minY > baselineStatistics.y.min)
                    minY = baselineStatistics.y.min;
                if (maxX < baselineStatistics.x.max)
                    maxX = baselineStatistics.x.max;
                if (maxY < baselineStatistics.y.max)
                    maxY = baselineStatistics.y.max;
            }
        }

        /* include min and max value range if they are to be displayed */
        if (viz.isActiveCtrl('show_minmax') && ptype.validQcBounds) {
            if (minY > ptype.qMin)
                minY = ptype.qMin;
            if (ptype.qMax > maxY)
                maxY = ptype.qMax;
        }

        /* create the scales for converting data point values to the SVG screen
         * coordinates, and vice versa */
        viz.scale.x = prepareEffectiveXscale(ptype.xt,
            minX, maxX, width, padding);
        viz.scale.y = prepareEffectiveYscale(minY, maxY, height, padding);


        /* create brush for implementing box selector */
        viz.state.n.b = d3.svg.brush();

        viz.minmax(); /* show min/max value range */

        /* render the statistics first; but remove existing DOM nodes that are
         * related to statistics visuals */
        containerDomNode.selectAll('.ebar').remove();
        containerDomNode.selectAll('.stat').remove();
        if (viz.isActiveCtrl('statistics')) {
            viz.state.n.s = containerDomNode.append('g').attr('class', 'stat');
            viz.whisker();
            viz.stat('mean');
            viz.stat('median');
            viz.stat('max');
            viz.stat('min');
            viz.quartiles();
            viz.overallstat();
        }

        /* remove default box selector (for making data point selections) if
         * visualisation is currently highlighting selected data points;
         * otherwise, activate default box selector */
        if (viz.isActiveCtrl('selected'))
            containerDomNode.selectAll('.box-selector').remove();
        else
            dcc_attachBoxSelector(viz, 'select', 'x', 'y');

        /* show all of the wildtype data points */
        containerDomNode.selectAll('.all-wildtype-points').remove();
        if (viz.isActiveCtrl('show_all') && viz.isActiveCtrl('wildtype'))
            viz.showBaselineDatapoints();

        /* show all of the mutant data points */
        containerDomNode.selectAll('.all-points').remove();
        if (viz.isActiveCtrl('show_all'))
            viz.showMutantDatapoints();

        /* show legends */
        viz.legends();

        /* now highlight the selected data set */
        viz.highlight();

        /* render selected data points, using specified circle radius */
        viz.selected(3);

        viz.title(); /* show title of the visualisation */
        viz.xaxis(); /* show chart axes */
        viz.yaxis();
        viz.crosshair(); /* finally, display the crosshair */
        dcc_svgMouseventHandler(viz); /* attach mouse move event */
    };

    /**
     * Renders a circle.
     *
     * @param {Object} svg SVG node to attach circle element to.
     * @param {Integer} cx x-coordinate of the center.
     * @param {Integer} cy y-coordinate of the center.
     * @param {Integer} radius Radius of the circle.
     * @param {String} cls Class to use for the circle.
     */
    function dcc_circle(svg, cx, cy, radius, cls) {
        return svg.append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', radius)
            .attr('class', cls);
    }

    /**
     * Renders a square.
     *
     * @param {Object} svg SVG node to attach circle element to.
     * @param {Integer} cx x-coordinate of the center of the square.
     * @param {Integer} cy y-coordinate of the center of the square.
     * @param {Integer} side Length of a side.
     * @param {String} cls Class to use for the circle.
     */
    function dcc_square(svg, cx, cy, side, cls) {
        var halfSide = side * .5;
        return svg.append('rect')
            .attr('x', cx - halfSide)
            .attr('y', cy + halfSide)
            .attr('width', side)
            .attr('height', side)
            .attr('class', cls);
    }

    /**
     * Renders a line segment
     *
     * @param {Object} svg SVG node to attach line element to.
     * @param {Integer} x1 x-coordinate of segment start.
     * @param {Integer} y1 y-coordinate of segment start.
     * @param {Integer} x2 x-coordinate of segment end.
     * @param {Integer} y2 y-coordinate of segment end.
     * @param {String} cls Class to use for the line segment.
     */
    function dcc_line(svg, x1, y1, x2, y2, cls) {
        return svg.append('line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2)
            .attr('class', cls);
    }

    /**
     * Renders a rectangle.
     *
     * @param {Object} svg SVG node to attach rectangular element to.
     * @param {Integer} x x-coordinate of top-left.
     * @param {Integer} y y-coordinate of top-left.
     * @param {Integer} width  Width of the rectangular element.
     * @param {Integer} height Height of the rectangular element.
     * @param {String} cls Class to use for the rectangular element.
     */
    function dcc_rect(svg, x, y, width, height, cls) {
        return svg.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('height', height)
            .attr('width', width)
            .attr('class', cls);
    }

    /**
     * Renders a text.
     *
     * @param {Object} svg SVG node to attach text element to.
     * @param {Integer} x x-coordinate of the text.
     * @param {Integer} y y-coordinate of the text.
     * @param {String} text The text to display.
     * @param {String} cls Class to use for the text segment.
     */
    function dcc_text(svg, x, y, text, cls) {
        return svg.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('class', cls)
            .text(text);
    }

    /**
     * All of the categories used in the current categorical data.
     */
    var dcc_CategoriesInUse = {}, dcc_CategoriesInUsecount = 0;

    /**
     * Displays segment information when mouse if over a segment.
     *
     * @param {Object} viz The visualisation object.
     * @param {Object} data Contains category, percentage and labels.
     */
    function dcc_onSegmentMouseOver(viz, data) {
        var suffix = data.l + (data.g ? ' male' : ' female')
            + ' specimens belong to the <b>'
            + data.c + '</b> category';
        d3.event.stopPropagation();
        dcc_relocateInformationBox(dcc_getBoundedMouseCoordinate(viz));
        dcc_InformationBox.html('<span class="category-detail-header">'
            + dcc.extjs.controller.ptype.yl + '</span><hr>'
            + '<b>' + data.p.toFixed(2) + '%</b> of ' + suffix
            + ', or<br><br><b>' + Math.round(data.p * data.t * .01)
            + '</b> out of <b>' + data.t + '</b> of ' + suffix)
            .attr('class', '');
    }

    function dcc_onSegmentMouseMove(viz) {
        d3.event.stopPropagation();
        dcc_relocateInformationBox(dcc_getBoundedMouseCoordinate(viz));
    }

    var dcc_segmentGradient = [
        '#ff0000', '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c',
        '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b',
        '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22',
        '#dbdb8d', '#17becf', '#9edae5'];

    function dcc_getGradient(svg, index) {
        var id = "gradient-" + index,
            baseColour = dcc_segmentGradient[index],
            rgbColour = d3.rgb(baseColour),
            gradient = svg.append("svg:defs")
            .append("svg:linearGradient")
            .attr("id", id)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%")
            .attr("spreadMethod", "pad");

        gradient.append("svg:stop")
            .attr("offset", "0%")
            .attr("stop-color", rgbColour.brighter(.8).toString())
            .attr("stop-opacity", 1);

        gradient.append("svg:stop")
            .attr("offset", "5%")
            .attr("stop-color", baseColour)
            .attr("stop-opacity", 1);

        gradient.append("svg:stop")
            .attr("offset", "90%")
            .attr("stop-color", rgbColour.darker(.5).toString())
            .attr("stop-opacity", 1);

        return 'url(#' + id + ')';
    }

    /**
     * Plots a segmented column with the supplied percentages.
     *
     * @param {Object} svg SVG node to render to.
     * @param {Boolean} isMale True if male; otherwise, female.
     * @param {Object} datum Category frequency total and percentages.
     * @param {Integer} x x-coordinate of segmented column bottom-left.
     * @param {Integer} y y-coordinate of segmented column bottom-left.
     * @param {Object} spec Specification for plotting each grid cell.
     */
    function dcc_plotSegmentColumn(svg, isMale, datum, x, y, spec) {
        var percentages = datum.s, segments = [], i, c,
            percentage, category, db,
            height = spec.ch * .01, /* converts percentage to height */
            width = spec.cw, viz = dcc.viz.specimen;

        /* convert hash table to catgory percentage array */
        for (category in percentages) {
            if (dcc_CategoriesInUse[category] === undefined)
                dcc_CategoriesInUse[category] = ++dcc_CategoriesInUsecount;
            percentage = percentages[category];
            segments.push({
                'c': category,
                'p': percentage,
                'h': percentage * height,
                'y': 0,
                's': dcc_CategoriesInUse[category], /* style index */
                'l': spec.l, /* grid label for segment detail */
                't': datum.t, /* total number of specimens */
                'g': isMale /* true if male; false otherwise */
            });
        }

        c = segments.length;
        if (c > 0) {
            /* sort the data by category */
            segments.sort(function(a, b) {
                return a.c > b.c ? 1 : (b.c > a.c ? -1 : 0);
            });

            /* set segment height and y-coordinate of top-left corner */
            segments[0].y = y - segments[0].h;
            for (i = 1, c = segments.length; i < c; ++i) {
                segments[i].y = segments[i - 1].y - segments[i].h;
            }

            /* display total count on top of the column */
            dcc_text(svg, x + .5 * width, segments[c - 1].y - 20,
                datum.t, 'segment-column-label');
            dcc_text(svg, x + .5 * width, segments[c - 1].y - 6,
                isMale ? 'Male' : 'Female', 'segment-column-label');
        }

        /* plot a segment for each category percentage */
        svg = svg.append('g').attr('class', 'category-grid');
        db = svg.selectAll('rect').data(segments);
        db.exit().remove();
        db.enter().append('rect')
            .attr('x', x)
            .attr('y', function(d) {
            return d.y;
        })
            .attr('width', width)
            .attr('height', function(d) {
            return d.h;
        })
            .attr('class', function(d) {
            return 'segment-' + d.s;
        })
            .style('fill', function(d) {
            return dcc_getGradient(svg, d.s);
        })
            .on('mouseover', function(d) {
            dcc_onSegmentMouseOver(viz, d);
        })
            .on('mousemove', function(d) {
            dcc_onSegmentMouseMove(viz);
        })
            .on('mouseout', function(d) {
            dcc_InformationBox.classed('hidden', true);
        });
    }

    /**
     * Calculates specification for plotting a grid column.
     *
     * @param {Integer} width Width of a grid cell.
     * @param {Integer} height Height of a grid cell.
     *
     * @returns {Object} Specification for plotting each grid cell.
     */
    function dcc_calculateColumnPlotSpecification(width, height) {
        /* divide grid cell horizontally into 10 equal rows,
         * and vertically into 20 equal columns */
        var dx = width * .1, dy = height * .05,
            /* used for dividing cell into male and female columns */
            horizontalCellMiddle = width * .5,
            /* make the column 6 rows high and 3 columns wide */
            columnHeight = dy * 16, columnWidth = dx * 3,
            /* vertical padding around the segmented column */
            topPadding = dy * 2, /* used for putting column label */
            bottomPadding = dy * 2, /* used for putting grid cell label */

            /* specification for horizontal reference bar */
            barX = dx * .5,
            barY = height - bottomPadding,
            barWidth = width - 2 * dx,
            barMiddle = horizontalCellMiddle * .5;

        return {
            'dx': dx,
            'dy': dy,
            'cm': horizontalCellMiddle,
            'cw': columnWidth,
            'ch': columnHeight,
            'tp': topPadding,
            'bp': bottomPadding,
            'bx': barX,
            'by': barY,
            'bw': barWidth,
            'bm': barMiddle
        };
    }

    /**
     * Plots two segmented bar charts, one for male and the other for female.
     *
     * @param {Object} svg SVG node to render to.
     * @param {Object} maleFreq Category frequency and percentages of male.
     * @param {Object} femalefreq Category frequency and percentages of female.
     * @param {Integer} x x-coordinate of cell visualisation top-left.
     * @param {Integer} y y-coordinate of cell visualisation top-left.
     * @param {Object} spec Specification for plotting each grid cell.
     * @param {String} label Grid cell label.
     */
    function dcc_plotFrequencyColumnCell(svg, maleFreq, femalefreq,
        x, y, spec, label) {
        var tx = x + spec.dx, ty = y + spec.by, dx = .5 * spec.dx;

        /* horizontal reference bar from which the segments are grown */
        dcc_line(svg, tx, ty, tx + spec.bw, ty, 'grid-bar');

        /* grid cell label */
        dcc_text(svg, x + spec.cm, ty + spec.dy, label, 'category-grid-label');

        /* pass the grid label for segment detail */
        spec.l = label.toLowerCase();

        /* plot male segmented column */
        dcc_plotSegmentColumn(svg, true, maleFreq, tx + dx, ty, spec);

        /* plot female segmented column */
        dcc_plotSegmentColumn(svg, false, femalefreq, x + spec.cm + dx, ty, spec);
    }

    /**
     * Plots the two-dimensional array of frequency columns.
     *
     * @param {Object} svg SVG node to render to.
     * @param {Object} freqGrid Frequency grid with category frequencies.
     * @param {Integer} x x-coordinate of grid top-left.
     * @param {Integer} y y-coordinate of grid top-left.
     * @param {Integer} width Width of a grid cell.
     * @param {Integer} height Height of a grid cell.
     */
    function dcc_plotFrequencyColumns(svg, freqGrid, x, y, width, height) {
        var spec = dcc_calculateColumnPlotSpecification(width, height);

        /* clear out existing category usage information */
        dcc_CategoriesInUse = {
            'Highlighted specimen': 0
        };
        dcc_CategoriesInUsecount = 0;

        /* plot homozygous */
        dcc_plotFrequencyColumnCell(svg,
            freqGrid[0][0].sm, /* mutant homozygous male */
            freqGrid[1][0].sm, /* mutant homozygous female */
            x, y, spec, 'Homozygous mutant', false);

        /* plot heterozygous */
        x += width;
        dcc_plotFrequencyColumnCell(svg,
            freqGrid[0][1].sm, /* mutant homozygous male */
            freqGrid[1][1].sm, /* mutant homozygous female */
            x, y, spec, 'Heterozygous mutant', false);

        /* plot both homozygous and heterozygous */
        x += width;
        dcc_plotFrequencyColumnCell(svg,
            freqGrid[0][2].sm, /* mutant male */
            freqGrid[1][2].sm, /* mutant female */
            x, y, spec, 'Mutant', false);

        /* plot wildtype */
        x += width;
        dcc_plotFrequencyColumnCell(svg,
            freqGrid[0][2].sb, /* wildtype male */
            freqGrid[1][2].sb, /* wildtype female */
            x, y, spec, 'Wildtype', true);
    }

    /**
     * Calculates the numbr of rows and columns for a two-dimensional
     * grid that can hold the supplied number of data points.
     *
     * @param {Integer} n Number of data points to fit.
     * @param {Integer} width Width of the rectangular area to fill.
     * @param {Integer} height Height of the rectangular area to fill.
     *
     * @returns {Object} Number of rows, columns, and cell width and height.
     */
    function dcc_calculateDatapointGridDimension(n, width, height) {
        /* our aim is to fit all of the data points inside the last column
         * of the visualisation grid. But first, we must calculate the
         * aspect ratio of this visualisation area.
         *
         *     aspect_ratio = width / height
         *
         * if c denotes the number of data points per row, we must have
         *
         *    c * (c / aspectRatio) >= number_of_data_points
         *
         * or, c >= sqrt(number_of_data_points * aspect_ratio)
         */
        var c = Math.ceil(Math.sqrt((n * width) / height)),
            r = Math.ceil(n / c);

        /* width and height for each data point */
        return {
            'r': r,
            'c': c,
            'w': width / c,
            'h': height / r
        };
    }

    /**
     * Plots categorical option values for all of the data points.
     *
     * @param {Object} svg SVG node to render to.
     * @param {Array} data Data set to plot.
     * @param {Integer} x x-coordinate of cell visualisation top-left.
     * @param {Integer} y y-coordinate of cell visualisation top-left.
     * @param {Integer} width Width of the rectangular area.
     * @param {Integer} height Height of the rectangular area.
     * @param {Function} dataPointOnMouseoverHandler Event handler for events
     *     when mouse hovers over a data point.
     * @param {Function} dataPointOnMouseoutHandler Event handler for events
     *     when mouse goes outside the data point.
     * @param {Function} dataPointOnMousemoveHandler Event handler for events
     *     when mouse moves over a data point.
     */
    function dcc_plotCategoricalDatapoints(svg, data, x, y, width, height,
        dataPointOnMouseoverHandler, dataPointOnMouseoutHandler,
        dataPointOnMousemoveHandler) {
        var k = 0, n = data.length, dataPoint, dataPointArray = [], tx, ty,
            dim = dcc_calculateDatapointGridDimension(n, width, height),
            c = dim.c, w = dim.w, h = dim.h, xHigh = x + width,
            highlightedSpecimen = dcc.getVisualisation('specimen').state.h;

        tx = x;
        ty = y;
        while (k < n) {
            dataPoint = data[k++];
            dataPointArray.push({
                'm': dataPoint.m, /* the measurement id */
                'a': dataPoint.a, /* animal id */
                'x': tx,
                'y': ty,
                'w': w, /* width */
                'h': h, /* height */
                'v': dataPoint.v /* category value */
            });

            tx += w;
            if (tx >= xHigh) {
                ty += h; /* next row */
                tx = x;
            }
        }

        svg.selectAll('.datapoints').remove();
        svg = svg.append('g').attr('class', '.datapoints');
        var db = svg.selectAll('rect').data(dataPointArray);
        db.exit().remove();
        db.enter().append('rect')
            .attr('x', function(d) {
            return d.x;
        })
            .attr('y', function(d) {
            return d.y;
        })
            .attr('width', function(d) {
            return d.w;
        })
            .attr('height', function(d) {
            return d.h;
        })
            .attr('mid', function(d) {
            return d.m;
        })
            .attr('aid', function(d) {
            return d.a;
        })
            .attr('class', function(d) {
            return 'segment-' + (d.a === highlightedSpecimen ? 0 :
                dcc_CategoriesInUse[d.v]);
        })
            .on('mouseover', dataPointOnMouseoverHandler)
            .on('mouseout', dataPointOnMouseoutHandler)
            .on('mousemove', dataPointOnMousemoveHandler);

        /* display data point label */
        dcc_text(svg, x + width * .5, y - 10,
            (data[0].g === 0 ? 'Wildtype' : 'Mutant') + ' data points grid',
            'categorical-datapoints');
    }

    /**
     * Display all of the legends.
     *
     * @param {Object} svg SVG node to render to.
     * @param {Object} freq Overall category frequency.
     * @param {Integer} x x-coordinate of legend top-left.
     * @param {Integer} y y-coordinate of legend top-left.
     * @param {Integer} width Width of the legends area.
     * @param {Integer} height Height of the legends area.
     */
    function dcc_displayCategoryLegends(svg, freq, x, y, width, height) {
        var legendsPerColumn = 3, count,
            category, ty = y, boxSize = 10, styleIndex, label;

        /* legend header */
        dcc_text(svg, x, y - boxSize,
            dcc.extjs.controller.ptype.yl, 'categorical-legend');

        count = legendsPerColumn;
        for (category in dcc_CategoriesInUse) {
            styleIndex = dcc_CategoriesInUse[category];
            dcc_rect(svg, x, ty, boxSize, boxSize, 'segment-' + styleIndex);
            label = category.icap();
            if (label.length > 24)
                label = label.substr(0, 24) + '...';
            dcc_text(svg, x + 2 * boxSize, ty + boxSize,
                label, 'segment-label');

            ty += boxSize * 2;

            /* display only six legends per column */
            if (count-- === 0) {
                x += 180;
                ty = y;
                count = legendsPerColumn;
            }
        }
    }


    /**
     * Creates a segment bar plot for categorical data.
     *
     * @param {Object} viz The visualisation object.
     */
    dcc.categoricalPlot = function(viz) {
        var state = viz.state,
            mutantData = state.sm, baselineData = state.sb,
            data = baselineData && baselineData.length > 0 ?
            mutantData.concat(baselineData) : mutantData,
            svg = state.n.v, vizDim = viz.chart.dim,
            padding = viz.dim.p, halfPadding = .5 * padding,
            width = vizDim.w - padding,
            height = vizDim.h - 2 * padding,
            /* divide the visualisation chart area into a 3x4 grid
             * 4th column cells are merged to display specific data point. the
             * rest of the grids display nine visualisations for each of the
             * following combinations:
             *
             *             Homozygous   Heterozygous   Homozygous/Heterozygous
             *        Male   (0, 0)        (0, 1)              (0, 2)
             *      Female   (1, 0)        (1, 1)              (1, 2)
             * Male/Female   (2, 0)        (2, 1)              (2, 2)
             */
            cellWidth = Math.floor(width / 5),
            cellHeight = Math.floor(height / 3),
            /* process the categorical data */
            freqGrid = dcc_processCategorical(data);

        /* used for on mouse over events for data points */
        viz.scale.x = dcc_getLinearScaler(0, vizDim.w, 0, vizDim.w);
        viz.scale.y = dcc_getLinearScaler(0, vizDim.h, vizDim.h, 0);

        /* root SVG node for plotting */
        d3.selectAll('.categorical').remove();
        svg = svg.append('g').attr('class', 'categorical');

        viz.title(); /* show title of the visualisation */

        dcc_plotFrequencyColumns(svg, freqGrid, padding * .25, 2 * padding,
            cellWidth, 3 * cellHeight);

        dcc_plotCategoricalDatapoints(svg, mutantData,
            halfPadding + 4 * cellWidth, 2 * padding + halfPadding,
            cellWidth, 2 * cellHeight,
            dcc_getDatapointOnMouseOverHandler(viz),
            null,
            dcc_getDatapointOnMouseMoveHandler(viz));

        dcc_displayCategoryLegends(svg, freqGrid[2][2],
            halfPadding, padding, width, height);

        dcc_svgMouseventHandler(viz); /* attach mouse move event */
    };

    /**
     * Plots a visualisation with charts and controls.
     *
     * @param {String} id Identifier for the visualisation.
     * @param {Object} type Type of visualisation.
     * @param {Object} mutantData Mutant measurements to plot.
     * @param {Object} baselineData Corresponding wildtype measurements.
     * @param {Objct} vizContainer DOM node that must contain the visualisation.
     */
    dcc.plot = function(id, type, mutantData, baselineData, vizContainer) {
        var viz, chart, temp, currentControls = null, currentSelected = {};

        if (!type || !type.t)
            return; /* invalid visualisation type */

        if (!id || id.length < 1) {
            throw new Error('Invalid visualisation identifier');
            return;
        }

        if (!vizContainer) {
            throw new Error('Invalid visualisation container');
            return;
        }

        if (!mutantData || mutantData.length < 1) {
            throw new Error('Data set is either invalid, or is empty');
            return;
        }

        /* save values for restoring current settings after resize, etc.*/
        viz = dcc.viz[id];
        if (viz !== undefined) {
            temp = viz.state;
            currentControls = temp.o;

            /* TODO: data context sensitive save and restore */
            currentSelected = temp.q;
            delete dcc.viz[id];
        }

        /* register the new visualisation */
        viz = dcc.viz[id] = new dcc.visualisation(id);
        viz.type = type.t;

        temp = viz.dim;
        temp.w = dcc_getNodeDimension(vizContainer, 'width');
        temp.h = dcc_getNodeDimension(vizContainer, 'height');
        temp.p = 80;

        temp = viz.label;
        temp.t = {
            p: type.l,
            q: type.yl
        };
        temp.x = type.xl;
        temp.y = type.yl;

        temp = viz.control.dim;
        temp.w = 280; /* from CSS */
        temp.h = viz.dim.h;

        temp = viz.chart.dim;
        temp.w = viz.dim.w - viz.control.dim.w - 15;
        temp.h = viz.dim.h;

        temp = viz.prop;
        temp.y = 'y'; /* measured value */
        temp.g = 'a'; /* animal id */
        temp.i = 'm'; /* measurement id */

        temp = viz.state;

        /* create a data point information box */
        chart = vizContainer.append('div').attr('id', 'specimen-centric-chart');
        dcc_InformationBox = chart.append('div')
            .attr('id', 'datapoint-infobox')
            .classed('hidden', true)
            .on('mouseover', function() {
            dcc_hideInformationBox(viz);
        });
        dcc_InformationBoxWidth =
            dcc_getNodeDimension(dcc_InformationBox, 'width')
            + dcc_InformationBoxOffset;
        dcc_InformationBoxHeight =
            dcc_getNodeDimension(dcc_InformationBox, 'height')
            + dcc_InformationBoxOffset;

        temp.n.v = chart.append('svg')
            .attr('width', viz.chart.dim.w)
            .attr('height', viz.chart.dim.h); /* D3 DOM object */

        temp.h = dcc.dataContext.aid;
        temp.q = currentSelected;
        if (currentControls)
            dcc.control_options = currentControls;
        else {
            if (dcc.control_options === null)
                dcc.control_options =
                    {
                        'series': 107712795,
                        'point': 118329627
                    };
        }
        temp.o = dcc.control_options;

        switch (viz.type) {
            case 'series':
                viz.prop.x = 'x'; /* attribute name for increment value */
                temp.f = dcc.seriesPlot; /* function to call upon refresh */
                temp.sm = dcc_calculateStatistics(mutantData, 'a', 'x',
                    'y', 'a', 'm');
                temp.sb = dcc_calculateStatistics(baselineData, 'a', 'x',
                    'y', 'a', 'm');
                break;

            case 'point':
                viz.prop.x = 'd'; /* attribute name for increment value */
                temp.f = dcc.seriesPlot; /* function to call upon refresh */
                temp.sm = dcc_calculateStatistics(mutantData, 'a', 'd',
                    'y', 'a', 'm');
                temp.sb = dcc_calculateStatistics(baselineData, 'a', 'd',
                    'y', 'a', 'm');
                break;

            case 'nominal':
                temp.f = dcc.categoricalPlot;

                /* NOTE: attributes 'sm' and 'sb' are storing raw data
                 * instead of storing statistics */
                temp.sm = mutantData;
                temp.sb = baselineData;
                break;

            default:
        }

        dcc_renderVisualisationControlInterface(vizContainer, viz);
        viz.refresh();
    };

    /**
     * Encapsulates a visualisation.
     *
     * @param {String} id Unique identifier for the visualisation.
     */
    dcc.visualisation = function(id) {
        this.id = id;
    };

    /**
     * Returns a visualisation object with the supplied identifier.
     *
     * @param {String} id Visualisation identifier.
     */
    dcc.getVisualisation = function(id) {
        return dcc.viz[id];
    };

    /**
     * Prototype definition for a visualisation object.
     */
    dcc.visualisation.prototype = {
        id: null, /* identifies the visualisation (must be unique) */
        type: null, /* the visualisation type */

        /* the dimensions of the visualisation, including controls */
        dim: {
            w: 0, /* width */
            h: 0, /* height */
            p: 0 /* padding for the chart components from the visualisation */
        },
        /* data point values must be sclaed to screen coordinates */
        scale: {
            x: null, /* x-axis scale */
            y: null /* y-axis scale */
        },
        /* textual labels that specialises the visualisation */
        label: {
            t: null, /* the title to display for the visualisation */
            x: null, /* x-axis label */
            y: null /* y-axis label */
        },
        /* chart properties, such as dimensions */
        chart: {
            dim: {/* the dimensions of the chart */
                w: 0, /* width */
                h: 0 /* height */
            }
        },
        /* control properties, such as dimensions */
        control: {
            dim: {/* the dimensions of the control */
                w: 0, /* width */
                h: 0 /* height */
            }
        },
        /* the properties that link the data-set to the visualisation */
        prop: {
            x: null, /* property, or index, that gives the x value */
            y: null, /* property, or index, that gives the y value */
            g: null, /* property, or index, to use as group key */
            i: null /* property, or index, that identifies a data point */
        },
        /* the current state of the visualisation */
        state: {
            /* handles to D3 DOM nodes */
            n: {
                v: null, /* the D3 object that contains the visualisation */
                b: null, /* box selector associated with the visualisation */
                s: null, /* root DOM node for statistics visuals */
                h: null, /* highlight selection */
                p: null, /* nodes with all points */
                a: {} /* axis nodes */
            },
            g: null, /* the current value of the group key */
            h: null, /* data point that is currently highlighted */
            sm: null, /* the current statistics object for mutant data */
            sb: null, /* the current statistics object for wildtype data */
            f: null, /* function that should be called to refresh the chart */
            o: null, /* the current state of the control */
            q: null, /* a one-dimensional array of selected data points */
            r: false, /* is visualisation currently resizing? */
            d: false /* is data point detail visible? */
        }
    };

    /* visualisation option bit masks */
    dcc.visualisation.prototype.omask = {
        none: 0x0, /* 32 -bits, 32 options possible */
        all: 0xffffffff, /* 32 -bits, 32 options possible */
        x_axis_label: 0x1,
        y_axis_label: 0x2,
        cross_hair: 0x4,
        wildtype: 0x8, /* show wildtype information */
        statistics: 0x10, /* show statistical information */

        whisker: 0x20, /* show following as whisker */
        max: 0x40,
        min: 0x80,
        mean: 0x100,
        median: 0x200,
        quartile: 0x400,
        /* show population standard deviation as error bars */
        std_error: 0x800,
        /* choices for displaying a data point */
        as_point: 0x1000,
        as_column: 0x2000, /* vertical column */
        as_bar: 0x4000, /* horizontal bar */

        highlight: 0x8000, /* highlight selected data-set */
        high_point: 0x10000, /* show data points */
        high_pline: 0x20000, /* show series polyline */

        show_all: 0x40000, /* show all data-set */
        all_point: 0x80000, /* show data points */
        all_pline: 0x100000, /* show series polyline */

        stat_point: 0x200000, /* show points in stat series */
        stat_pline: 0x400000, /* show series polyline for stat series */
        selected: 0x800000, /* show selected points only */
        overall_stat: 0x1000000, /* show overall statistics */

        all_male: 0x2000000, /* show male data points */
        all_female: 0x4000000, /* show female data points */

        show_minmax: 0x8000000, /* show QC min/max range */
        use_iqr: 0x10000000 /* extend whiskers to 1.5 IQR */
    };

    /**
     * Checks if the option with the specified key has been selected.
     * 
     * @param {Integer} controlBitMap Bitmap for control option.
     *
     * @return True if the option is 'on'; otherwise, false.
     */
    dcc.visualisation.prototype.isActiveCtrl = function(controlBitMap) {
        var me = this;
        return (me.state.o[me.type] & me.omask[controlBitMap]) > 0;
    };

    /**
     * Checks if the current state has one of the bits active.
     * 
     * * @param {Integer} controlsBitMap Bitmap for multiple control options.
     *
     * @return True if one of the options is 'on'; otherwise, false.
     */
    dcc.visualisation.prototype.hasActiveCtrls = function(controlsBitMap) {
        var me = this;
        return (me.state.o[me.type] & controlsBitMap) > 0;
    };

    /**
     * Retrieves selected data points as an array of measurement identifiers.
     */
    dcc.visualisation.prototype.retrieve = function() {
        var me = this, dataPoints = me.state.q, selected = [], i;
        for (i in dataPoints)
            selected.push(dataPoints[i].m);
        return selected;
    };

    /**
     * Refreshes the visualisation by clearing out existing visualisation, and
     * then redrawing the visualisation from scratch.
     */
    dcc.visualisation.prototype.refresh = function() {
        var me = this, t = me.state;
        if (t.f)
            t.f(me);
    };

    /**
     * Adds title of the visualisation.
     */
    dcc.visualisation.prototype.title = function() {
        var me = this, g = me.state.n.v, t;
        g.select('.viz-title').remove();
        t = dcc_text(g, me.chart.dim.w * .5, me.dim.p * .35, '', 'viz-title');
        t.append('tspan').text(me.label.t.p + ' ');
        t.append('tspan').text(me.label.t.q);
    };

    /**
     * Display min/max value range.
     */
    dcc.visualisation.prototype.minmax = function() {
        var ptype = dcc.extjs.controller.ptype;
        if (ptype.validQcBounds) {
            var me = this, g = me.state.n.v;
            g.select('.min-max-band').remove();
            if (me.isActiveCtrl('show_minmax')) {
                var scale = me.scale, yScale = scale.y,
                    xRange = scale.x.range(), max = yScale(ptype.qMax);
                dcc_rect(g, xRange[0], max, xRange[1] - xRange[0],
                    yScale(ptype.qMin) - max, 'min-max-band');
            }
        }
    };

    /**
     * Adds male/female legends on the visualisation.
     */
    dcc.visualisation.prototype.legends = function() {
        var me = this, g = me.state.n.v,
            x = me.dim.p + 2.5, y = me.dim.p - 16;
        var t = g.select('.viz-legends').remove();

        t = g.append('g').attr('class', 'viz-legends');
        if (me.isActiveCtrl('show_all')) {
            if (dcc.dataContext.gid === 0) {
                if (me.isActiveCtrl('all_female')) {
                    dcc_square(t, x, y - 10, 10, 'female');
                    x += 10;
                    dcc_text(t, x, y + 5, 'Female (WT)');
                    x += 90;
                }

                if (me.isActiveCtrl('all_male')) {
                    dcc_square(t, x, y - 10, 10, 'male');
                    x += 10;
                    dcc_text(t, x, y + 5, 'Male (WT)');
                    x += 70;
                }
            } else {
                if (me.isActiveCtrl('all_female')) {
                    dcc_circle(t, x, y, 5, 'female');
                    x += 10;
                    dcc_text(t, x, y + 5, 'Female');
                    x += 70;

                    if (me.isActiveCtrl('wildtype')) {
                        dcc_square(t, x, y - 10, 10, 'female');
                        x += 10;
                        dcc_text(t, x, y + 5, 'Female (WT)');
                        x += 90;
                    }
                }

                if (me.isActiveCtrl('all_male')) {
                    dcc_circle(t, x, y, 5, 'male');
                    x += 10;
                    dcc_text(t, x, y + 5, 'Male');
                    x += 50;

                    if (me.isActiveCtrl('wildtype')) {
                        dcc_square(t, x, y - 10, 10, 'male');
                        x += 10;
                        dcc_text(t, x, y + 5, 'Male (WT)');
                        x += 70;
                    }
                }
            }
        }

        /**
         * We display circles and polylines for highlighted data set, when
         * any of the following controls are active:
         *
         * highlight    : 0x8000
         * high_point   : 0x10000
         * high_pline   : 0x20000
         */
        if (me.isActiveCtrl('highlight')) {
            if (dcc.extjs.controller.ptype.t === 'series'
                && me.isActiveCtrl('high_pline')) {
                dcc_line(t, x, y, x + 30, y, 'highlighted');
            }

            if (me.isActiveCtrl('high_point')) {
                if (dcc.dataContext.gid === 0) {
                    dcc_square(t, x + 15, y - 10, 10, 'legend-highlighted');
                } else {
                    dcc_circle(t, x + 15, y, 5, 'legend-highlighted');
                }
            }

            /* Only display label if either, or both, circle and polyline
             * are visible. Or'ing high_point and high_pline gives 196608.
             */
            if (me.hasActiveCtrls(196608)) {
                x += 40;
                dcc_text(t, x, y + 5, 'Highlighted');
                x += 80;
            }
        }

        if (me.isActiveCtrl('statistics')) {


            /* We display a dotted wildtype when any of the following
             * controls is active:
             *
             * max      : 0x40
             * min      : 0x80
             * mean     : 0x100
             * median   : 0x200
             * quartile : 0x400
             *
             * Or'ing them gives 1984.
             */
            if (me.hasActiveCtrls(1984)) {
                if (me.isActiveCtrl('wildtype') && dcc.dataContext.gid !== 0) {
                    dcc_line(t, x, y, x + 30, y, 'wildtype');
                    x += 30;
                    dcc_text(t, x, y + 5, 'Wildtype');
                    x += 75;
                }
            } else {
                x += 15;
            }

            if (me.isActiveCtrl('whisker')) {
                if (dcc.dataContext.gid !== 0) {
                    dcc_rect(t, x - 5, y - 5, 10, 10, 'whisker mutant');
                    x += 12;
                    dcc_text(t, x, y + 5, 'Mutant');
                    x += 65;

                    if (me.isActiveCtrl('wildtype')) {
                        dcc_rect(t, x - 5, y - 5, 10, 10, 'whisker wildtype');
                        x += 12;
                        dcc_text(t, x, y + 5, 'Wildtype');
                    }
                }
            }
        }
    };

    /**
     * Adds the x-axis of the plot.
     */
    dcc.visualisation.prototype.xaxis = function() {
        var me = this, g = me.state.n.v;
        if (me.isActiveCtrl('x_axis_label'))
            dcc_plotAxis('x', me, 'bottom', me.label.x);
        else
            g.selectAll('.x-axis').remove();
    };

    /**
     * Adds the y-axis of the plot.
     */
    dcc.visualisation.prototype.yaxis = function() {
        var me = this, g = me.state.n.v;
        if (me.isActiveCtrl('y_axis_label'))
            dcc_plotAxis('y', me, 'left', me.label.y);
        else
            g.selectAll('.y-axis').remove();
    };

    /**
     * Returns the population standard deviation of a column group with
     * the same x-axis key value.
     *
     * @param {Object} statistics The statistics object.
     * @param {Object} groupKey The key that was used to group data points
     *     into a column.
     */
    function dcc_getColumnStandardDeviation(statistics, groupKey) {
        var columnStatistics = statistics.c.c,
            indexInStatisticsTable = statistics.c.i[groupKey];
        return columnStatistics[indexInStatisticsTable].s.sd;
    }

    /**
     * Returns the standard error for a column group with the same x-axis
     * key value.
     *
     * @param {Object} statistics The statistics object.
     * @param {Object} groupKey The key that was used to group data points
     *     into a column.
     */
    function dcc_getColumnStandardError(statistics, groupKey) {
        var columnStatistics = statistics.c.c,
            indexInStatisticsTable = statistics.c.i[groupKey];
        return columnStatistics[indexInStatisticsTable].s.se;
    }

    /**
     * Adds error bars to the series that is currently highlighted.
     *
     * @param {Integer} index Index of the highlighted series.
     */
    dcc.visualisation.prototype.errorbar = function(index) {
        var me = this, i, /* this visualisation object and counter */
            dataPoint, groupIdPrefix = 'group-' + index + '_',
            containerDomNode = me.state.n.s, /* contains all statistics visuals */
            statistics = dcc_getStatistics(me, true), /* get mutant statistics */
            seriesDataPoints = statistics.r.r[index].d,
            numDataPoints = seriesDataPoints.length;

        containerDomNode.selectAll('.ebar').remove();
        for (i = 0; i < numDataPoints; ++i) {
            dataPoint = seriesDataPoints[i];
            dcc_plotStandardError(groupIdPrefix + i, me,
                dataPoint.x, dataPoint.y,
                dcc_getColumnStandardError(statistics, dataPoint.x), 10);
        }
    };

    /**
     * Adds a whisker box plot for each of the column groups with the same
     * x-axis value. All of the whisker plot components, for each of the
     * whisker plots, are contained inside a DOM node with class 'whisker'.
     */
    dcc.visualisation.prototype.whisker = function() {
        var me = this, i, temp, /* this visualisation object, counter & temp */
            containerDomNode = me.state.n.s, /* contains all statistics visuals */
            mutantStatistics = dcc_getStatistics(me, true),
            baselineStatistics = dcc_getStatistics(me, false),
            numColumnGroups, displacement = 20, width = 16;
        if (me.isActiveCtrl('whisker')) {
            if (me.isActiveCtrl('wildtype') && baselineStatistics !== null) {
                displacement = 60;
                width = 16;

                /* get column statistics for each x-axis value */
                baselineStatistics = baselineStatistics.c.c;

                /* show box and whisker plot for each of the x-axis values */
                numColumnGroups = baselineStatistics.length;
                for (i = 0; i < numColumnGroups; ++i) {
                    temp = baselineStatistics[i];
                    dcc_plotBoxAndWhisker('group-' + i, me, temp.s, temp.k,
                        displacement, width, 'wildtype');
                }

                displacement = 35;
            }

            if (mutantStatistics !== null) {
                /* get column statistics for each x-axis value */
                mutantStatistics = mutantStatistics.c.c;

                /* show box and whisker plot for each of the x-axis values */
                numColumnGroups = mutantStatistics.length;
                for (i = 0; i < numColumnGroups; ++i) {
                    temp = mutantStatistics[i];
                    dcc_plotBoxAndWhisker('group-' + i, me, temp.s, temp.k,
                        displacement, width, 'mutant');
                }
            }
        } else
            containerDomNode.selectAll('.whisker').remove();
    };

    function objectIsEmpty(t) {
        var k;
        for (k in t)
            return false;
        return true;
    }

    /**
     * Highlights the data points that are currently selected. All of the
     * selected data points that are to be highlighted are redrawn over
     * a translucent mask, which covers all of the existing visuals. This helps
     * the user to establish a reference frame for the selection.
     *
     * <p>To implement this facility, we use two important parts:
     *     <ul>
     *         <li>The translucent mask DOM node is dynamically inserted over
     *         the existing visuals. All of the data points are then redrawn
     *         on top of this DOM node.</li>
     *         <li>Secndly, we esablish a new box selector, which is only
     *         effective on this translucent DOM mask. This allows a user
     *         to unselect points that are currently highlighted.<li>
     *     </ul>
     * </p>
     *
     * @param {Integer} radius Radius of the data point circle in pixels.
     */
    dcc.visualisation.prototype.selected = function(radius) {
        var me = this, visualisationDomNode = me.state.n.v,
            selectedDataPoints = me.state.q;

        if (me.isActiveCtrl('selected')) {
            var visualisationDimension = me.dim,
                xScale = me.scale.x, yScale = me.scale.y;

            /* add highlighted selection DOM node group */
            visualisationDomNode.selectAll('.highlight-selection').remove();
            me.state.n.h = visualisationDomNode.append('g')
                .attr('class', 'highlight-selection');

            /* add translucent mask */
            dcc_rect(me.state.n.h, 0, 0,
                visualisationDimension.w, visualisationDimension.h);

            if (objectIsEmpty(selectedDataPoints)) {
                dcc_text(me.state.n.h,
                    me.chart.dim.w * .5,
                    me.chart.dim.h * .5,
                    'No cited datapoints or selection', 'no-selection');
            } else {
                /* attach a new box selector (for data point removal) which is
                 * effective on the translucent mask */
                dcc_attachBoxSelector(me, 'remove', 'x', 'y');

                /* bind the selected data points to circles */
                var dataBinding = me.state.n.h.selectAll('circle')
                    .data(function() {
                    var i, m = [], datapoint, measurement, x,
                        controller = dcc.extjs.controller;
                    for (i in selectedDataPoints) {
                        datapoint = selectedDataPoints[i];
                        measurement = controller.getMeasurement(datapoint.m);
                        if (measurement !== undefined) {
                            x = measurement.get('i');
                            if (x === '')
                                x = measurement.get('d');
                            m.push({
                                m: datapoint.m,
                                a: measurement.get('a'),
                                x: x,
                                y: measurement.get('v'),
                                sx: xScale(x),
                                sy: yScale(measurement.get('v'))
                            });
                        }
                    }
                    return m;
                });

                /* remove existing data points that are no longer selected */
                dataBinding.exit().remove();

                /* add data points that are currently in the selection */
                dataBinding.enter()
                    .append('circle')
                    .attr('r', radius)
                    .attr('cx', function(d) {
                    return dcc.dataContext.gid === 0 ?
                        d.sx + WILDTYPE_DATAPOINT_DISPLACEMENT : d.sx;
                })
                    .attr('cy', function(d) {
                    return d.sy;
                })

                    /* capture and discard individual 'mousedown' and 'mouseup'
                     * events, so that only 'click' events are fired. This is
                     * necessary because the box selector fires both 'mousedown'
                     * and 'mouseup' events, in addition to the 'click' events;
                     * but we only need click */
                    .on('mouseup', function() {
                    d3.event.stopPropagation();
                })
                    .on('mousedown', function() {
                    d3.event.stopPropagation();
                })
                    .on('click', function(d) {
                    /* remove data points from the selection, and visuals */
                    if (selectedDataPoints[d.m])
                        delete selectedDataPoints[d.m];
                    d3.select(this).remove();
                })
                    .on('mouseover', dcc_getDatapointOnMouseOverHandler(me))
                    .on('mousemove', dcc_getDatapointOnMouseMoveHandler(me));
            }
            if (me.state.numInitiallyCited > me.state.numFoundCited) {
                dcc_text(me.state.n.h,
                    me.chart.dim.w * .5,
                    me.chart.dim.h * .5 + 20,
                    '(' +
                    (me.state.numInitiallyCited - me.state.numFoundCited) +
                    ' out of ' + me.state.numInitiallyCited +
                    ' initially cited datapoints have since been removed)',
                    'no-selection');
            }
        } else
            visualisationDomNode.selectAll('.highlight-selection').remove();
    };

    /**
     * Adds statistics visual for the supplied statistics type.
     *
     * @param {String} statisticsType Type of statistics data-points to render.
     */
    dcc.visualisation.prototype.stat = function(statisticsType) {
        var me = this, containerDomNode = me.state.n.s;
        if (me.isActiveCtrl(statisticsType)) {
            var mutantStatistics = dcc_getStatistics(me, true),
                baselineStatistics = dcc_getStatistics(me, false),
                showDataPoints = me.isActiveCtrl('stat_point'),
                showPolyline = me.isActiveCtrl('stat_pline'),
                /* function to retrieve unscaled data points */
                getData = function(d) {
                return {
                    m: d.m,
                    a: d.a,
                    x: d.k,
                    y: d.s[statisticsType]
                };
            };

            /* show wildtype visual */
            if (me.isActiveCtrl('wildtype') && baselineStatistics !== null) {
                dcc_plotSeries('wildtype-' + statisticsType, /* DOM id */
                    /* column statistics: for all x-axis values */
                    baselineStatistics.c.c,
                    getData,
                    me, /* use this visualisation object for the rendering */
                    containerDomNode, /* where to render to */
                    null, /* mouseover event-handler (currently not used) */
                    null, /* mousemove event-handler (currently not used) */
                    null, /* click event-handler (curretly not used) */
                    showDataPoints, /* should we display data point */
                    showPolyline, /* should we display ployline */
                    'c', /* draw circle */
                    3); /* radius of the data point circle in pixel */
            }

            /* show mutant visual */
            if (mutantStatistics !== null) {
                dcc_plotSeries(statisticsType, /* DOM identifier */
                    /* column statistics: for all x-axis values */
                    mutantStatistics.c.c,
                    getData,
                    me, /* use this visualisation object for the rendering */
                    containerDomNode, /* where to render to */
                    null, /* mouseover event-handler (currently not used) */
                    null, /* mousemove event-handler (currently not used) */
                    null, /* click event-handler (curretly not used) */
                    showDataPoints, /* should we display data point */
                    showPolyline, /* should we display ployline */
                    'c', /* draw circle */
                    3); /* radius of the data point circle in pixel */
            }
        } else
            containerDomNode.selectAll('.' + statisticsType).remove();
    };

    /**
     * Adds the overall statistics for the entire dataset. This will display
     * horizontal lines for the mean, median, and 1st and 3d quartiles.
     */
    dcc.visualisation.prototype.overallstat = function() {
        var me = this, mutantStatistics = dcc_getStatistics(me, true),
            baselineStatistics = dcc_getStatistics(me, false),
            containerDomNode = me.state.n.s; /* contains all statistics visuals */
        if (me.isActiveCtrl('overall_stat')) {
            if (me.isActiveCtrl('wildtype') && baselineStatistics)
                dcc_plotStatistics(me, baselineStatistics.o.y, 10, true);
            if (mutantStatistics !== null)
                dcc_plotStatistics(me, mutantStatistics.o.y, 10, false);
        } else
            containerDomNode.selectAll('.overall-stat').remove();
    };

    /**
     * Adds the quartile series. This will only render the 1st and 3rd
     * quartiles. The second quartile, which is the median, can be rendered
     * separately using the stat() method.
     */
    dcc.visualisation.prototype.quartiles = function() {
        var me = this, mutantStatistics = dcc_getStatistics(me, true),
            baselineStatistics = dcc_getStatistics(me, false),
            containerDomNode = me.state.n.s; /* contains all statistics visuals */

        if (me.isActiveCtrl('quartile')) {
            var showDataPoints = me.isActiveCtrl('stat_point'),
                showPolyline = me.isActiveCtrl('stat_pline'),
                showBaseline = me.isActiveCtrl('wildtype')
                && baselineStatistics !== null,
                /* function to retrieve 1st quartile */
                getQ1 = function(d) {
                return {
                    m: d.m,
                    a: d.a,
                    x: d.k,
                    y: d.s.quartile === null ? null : d.s.quartile.q1
                };
            },
                /* function to retrieve 3rd quartile */
                getQ3 = function(d) {
                return {
                    m: d.m,
                    a: d.a,
                    x: d.k,
                    y: d.s.quartile === null ? null : d.s.quartile.q3
                };
            };

            if (showBaseline) {
                dcc_plotSeries('wildtype-q1', baselineStatistics.c.c, getQ1,
                    me, containerDomNode, null, null, null,
                    showDataPoints, showPolyline, 'c', 3);
                dcc_plotSeries('wildtype-q3', baselineStatistics.c.c, getQ3,
                    me, containerDomNode, null, null, null,
                    showDataPoints, showPolyline, 'c', 3);
            }

            if (mutantStatistics !== null) {
                dcc_plotSeries('q1', mutantStatistics.c.c,
                    getQ1, me, containerDomNode, null, null, null,
                    showDataPoints, showPolyline, 'c', 3);
                dcc_plotSeries('q3', mutantStatistics.c.c,
                    getQ3, me, containerDomNode, null, null, null,
                    showDataPoints, showPolyline, 'c', 3);
            }
        } else {
            containerDomNode.selectAll('.q1').remove();
            containerDomNode.selectAll('.q3').remove();
        }
    };

    /**
     * Shows all of the mutant datapoints as a series.
     */
    dcc.visualisation.prototype.showMutantDatapoints = function() {
        var me = this, groupPrefix = ' group-', id, dataPoints,
            state = me.state, /* current state of the visualisation */
            statistics = dcc_getStatistics(me, true), i, l,
            showDataPoints = me.isActiveCtrl('all_point'),
            showPolyline = me.isActiveCtrl('all_pline'),
            showMale = me.isActiveCtrl('all_male'),
            showFemale = me.isActiveCtrl('all_female'),
            datapointSvgGroup,
            isMale = function(dataPoint) {
            return dataPoint.s === 1;
        };

        if (statistics === null)
            return;
        
        if (me.isActiveCtrl('as_point')) {
            datapointSvgGroup = state.n.v.append('g')
                .attr('class', 'all-points');

            for (i = 0, l = statistics.r.r.length; i < l; ++i) {
                dataPoints = statistics.r.r[i].d;

                if (isMale(dataPoints[0])) {
                    if (showMale)
                        id = 'male' + groupPrefix + i;
                    else
                        continue;
                } else {
                    if (showFemale)
                        id = 'female' + groupPrefix + i;
                    else
                        continue;
                }

                dcc_plotSeries(id, dataPoints,
                    function(d) {
                        return {
                            m: d.m,
                            a: d.a,
                            x: d.x,
                            y: d.y,
                            s: d.s
                        };
                    },
                    me, datapointSvgGroup,
                    dcc_getDatapointOnMouseOverHandler(me),
                    dcc_getDatapointOnMouseMoveHandler(me),
                    dcc_getDatapointOnMouseClickHandler(me),
                    showDataPoints, showPolyline,
                    dcc.dataContext.gid === 0 ? 's' : 'c', 3);
            }
        }
    };

    /**
     * Shows all of the wildtype datapoints as a series.
     */
    dcc.visualisation.prototype.showBaselineDatapoints = function() {
        /* if the current data context is wildtype related, ignore this */
        if (dcc.dataContext.gid === 0)
            return;

        var me = this, groupPrefix = ' group-', id, dataPoints,
            state = me.state, /* current state of the visualisation */
            statistics = dcc_getStatistics(me, false), i, l,
            showDataPoints = me.isActiveCtrl('all_point'),
            showPolyline = me.isActiveCtrl('all_pline'),
            showMale = me.isActiveCtrl('all_male'),
            showFemale = me.isActiveCtrl('all_female'),
            datapointSvgGroup,
            isMale = function(dataPoint) {
            return dataPoint.s === 1;
        };

        if (statistics === null)
            return;

        if (me.isActiveCtrl('as_point')) {
            datapointSvgGroup = state.n.v.append('g')
                .attr('class', 'all-wildtype-points');

            for (i = 0, l = statistics.r.r.length; i < l; ++i) {
                dataPoints = statistics.r.r[i].d;

                if (isMale(dataPoints[0])) {
                    if (showMale)
                        id = 'male' + groupPrefix + i;
                    else
                        continue;
                } else {
                    if (showFemale)
                        id = 'female' + groupPrefix + i;
                    else
                        continue;
                }

                dcc_plotSeries(id, dataPoints,
                    function(d) {
                        return {
                            m: d.m,
                            a: d.a,
                            x: d.x,
                            y: d.y,
                            s: d.s
                        };
                    },
                    me, datapointSvgGroup,
                    dcc_getDatapointOnMouseOverHandler(me),
                    dcc_getDatapointOnMouseMoveHandler(me),
                    null, showDataPoints, showPolyline, 's', 3);
            }
        }
    };

    /**
     * Show the data points that corresponds to the highlighted mutant specimen.
     * Each data point corresponds to a series of measurements taken on the
     * same mutant specimen at different times, condition, or regular intervals.
     */
    dcc.visualisation.prototype.highlight = function() {
        var me = this, index, seriesDataPoints,
            state = me.state, /* current state of the visualisation */
            containerDomNode = state.n.v, /* the root of visuals */
            statistics = dcc_getStatistics(me, true),
            specimenToHighlight = state.h;

        containerDomNode.select('.series.highlighted').remove();
        if (me.isActiveCtrl('highlight') && specimenToHighlight !== -1) {
            if (statistics) {
                index = statistics.r.i[specimenToHighlight];
                if (index !== undefined) {
                    seriesDataPoints = statistics.r.r[index];
                    if (seriesDataPoints !== undefined) {
                        if (me.isActiveCtrl('statistics') &&
                            me.isActiveCtrl('std_error'))
                            me.errorbar(index);
                        dcc_plotSeries('highlighted',
                            seriesDataPoints.d,
                            function(d) {
                                return {
                                    m: d.m,
                                    a: d.a,
                                    x: d.x,
                                    y: d.y,
                                    s: d.s
                                };
                            },
                            me, containerDomNode,
                            dcc_getDatapointOnMouseOverHandler(me),
                            dcc_getDatapointOnMouseMoveHandler(me),
                            dcc_getDatapointOnMouseClickHandler(me),
                            me.isActiveCtrl('high_point'),
                            me.isActiveCtrl('high_pline'), 'c', 3);
                    }
                } else {
                    dcc_text(containerDomNode,
                        me.chart.dim.w * .5, me.dim.p * .6,
                        '(No data points visible for highlighted specimen)',
                        'series highlighted viz-warning');
                }
            }
        }
    };

    /**
     * Show the crosshair.
     */
    dcc.visualisation.prototype.crosshair = function() {
        var me = this, containerDomNode;
        if (me.isActiveCtrl('cross_hair'))
            dcc_renderCrosshair(me);
        else {
            /* remove crosshair components and the event handlers */
            containerDomNode = me.state.n.v;
            containerDomNode.selectAll('.xhair').remove();
            containerDomNode.on('mousemove', null);
        }
    };

    /**
     * Returns a plotting type for a parameter object.
     *
     * <p>The parameters web service returns a JSON string that contains an
     * array of parameter objects for the supplied procedure. Each of these
     * JSON objects have some of the following attributes:</p>
     *
     * <ul>
     * <li>p: procedure id</li>
     * <li>i: parameter id</li>
     * <li>e: parameter stable identifier</li>
     * <li>n: parameter name</li>
     * <li>s: sequence number in the list of parameters</li>
     * <li>d: datatype of the measured value</li>
     * <li>u: measurement unit</li>
     * <li>ii: increment identifier</li>
     * <li>im: increment minimum</li>
     * <li>it: increment type</li>
     * <li>iu: increment unit</li>
     * <li>iv: increment value</li>
     * </ul>
     *
     * <p>The returned object has the following attributes:</p>
     *
     * <ul>
     * <li>t: type of the graph/plot to use. The types are given below</li>
     * <li>xc: string-to-value convertor function to use on x-axis</li>
     * <li>yc: string-to-value convertor function to use on y-axis</li>
     * <li>xl: label for the x-axis</li>
     * <li>xt: type of x-axis value</li>
     * <li>yl: label for the y-axis</li>
     * <li>l: chart title</li>
     * </ul>
     *
     * <p>The recognised string codes for graph/plot types are:</p>
     *
     * <ul>
     * <li>noplot: Do not plot (unplottable data)</li>
     * <li>point: Single point plot</li>
     * <li>series: Series plot (points and lines)</li>
     * <li>scatter: Scattor plot.</li>
     * </ul>
     *
     * @param {Object} parameter Parameter object.
     *
     * @return The plotting type that is appropriate for the parameter.
     */
    dcc.determinePlotType = function(parameter) {
        var plotType = {};
        if (!parameter)
            plotType = null; /* invalid parameter */
        else {
            if (parameter.d === null || parameter.d === undefined) {
                /* don't plot: no data type available for conversion */
                plotType.t = 'noplot';
            } else {
                plotType.l = parameter.a; /* procedure name */

                /* some strings values in the database are not trimmed */
                parameter.d = parameter.d.trim(); /* data Ftype */

                if (parameter.d === 'TEXT') {
                    switch (parameter.t) {
                        case 0:
                            plotType.t = 'meta';
                            break;
                        case 3: /* categorical data set */
                            plotType.t = 'nominal';
                            plotType.yl = parameter.n.icap();
                            break;
                    }
                } else {
                    /* unit of measurement */
                    parameter.u = parameter.u ? parameter.u.trim() : null;

                    if (parameter.d.length === 0 ||
                        'NULL' === parameter.d) {
                        if (parameter.u === null || parameter.u.length === 0) {
                            /* don't plot: no data type or unit */
                            plotType.t = 'noplot';
                        } else {
                            /* assume float if unit is specified */
                            parameter.d = 'float';
                            plotType = dcc_getLabelsAndConvertors(parameter);
                        }
                    } else
                        plotType = dcc_getLabelsAndConvertors(parameter);
                }
            }
        }

        /* maximum and minimum value range for QC */
        plotType.validQcBounds = parameter.qb;
        plotType.qMax = parameter.qM;
        plotType.qMin = parameter.qm;
        return plotType;
    };

    /**
     * Determine plot type, axis labels and data convertors.
     *
     * NOTE: the following code is not clean because it has to make several
     * assumptions when data in EMPReSS is inconsistent.
     *
     * @param parameter Parameter object.
     * @return The plot type, data convertors and axis labels.
     */
    function dcc_getLabelsAndConvertors(parameter) {
        /* initialise with convertor function for measurement values
         * and the parameter name */
        var plotType = {
            yc: dcc_getDataConvertor(parameter.d),
            yl: parameter.n,
            l: parameter.a /* procedure name */
        };

        /* prepare y-axis label (append unit if present) */
        plotType.yl += !parameter.u || parameter.u.length < 1 ?
            '' : ' (' + parameter.u + ')';

        /* is there an increment? */
        if (parameter.ii) {
            parameter.it = parameter.it ? parameter.it.trim() : null;
            parameter.iu = parameter.iu ? parameter.iu.trim() : null;

            switch (parameter.it) {
                case 'float':
                    /* if unit is minutes, plot as series; otherwise, scatter */
                    if ('minutes' === parameter.iu) {
                        plotType.t = 'series';
                        plotType.xt = 'i';
                    } else {
                        plotType.t = 'scatter';
                        plotType.xt = 'f';
                    }

                    /* convertor function for increment values */
                    plotType.xc = dcc_getDataConvertor(parameter.it);
                    plotType.xl = parameter.iu; /* prepare x-axis label */
                    break;

                case 'repeat':
                    plotType.t = 'series'; /* plot as series */
                    plotType.xl = parameter.iu; /* prepare x-axis label */

                    /* convertor function for increment values */
                    switch (parameter.iu) {
                        case 'number':
                        case 'Age In Days':
                            plotType.xc = dcc_getDataConvertor('integer');
                            plotType.xt = 'i';
                            break;

                        case 'Time in hours relative to lights out':
                            plotType.xc = dcc_getDataConvertor('float');
                            plotType.xt = 'f';
                            break;

                        default:
                            plotType.xc = dcc_getDataConvertor('float');
                            plotType.xt = 'f';
                    }
                    break;

                case 'datetime':
                    plotType.t = 'series'; /* plot as series */
                    plotType.xl = parameter.iu; /* prepare x-axis label */

                    /* convertor function for increment values */
                    if (parameter.iu === 'Time in hours relative to lights out') {
                        plotType.xc = dcc_getDataConvertor('float');
                        plotType.xt = 'f';
                    }
                    break;
            }

            /* make first character uppercase */
            if (plotType.xl)
                plotType.xl = plotType.xl.icap();
        } else {
            plotType.t = 'point';

            /* if there are no increments, the experiment start date gives
             * the x-axis values, and these are date values. */
            plotType.xt = 'd';
            plotType.xc = dcc_getDataConvertor('date/time');
            plotType.xl = "Experiment date";
        }
        if (plotType.yl)
            plotType.yl = plotType.yl.icap();
        return plotType;
    }

    /**
     * Returns a function that converts a string to an appropriate data type.
     *
     * NOTE:
     * Europhenome database uses different strings to represent the same data.
     * Ideally, this should be fixed because it makes this function expensive.
     *
     * @param {String} datatype Data type for conversion from string.
     * @return A convertor function.
     */
    function dcc_getDataConvertor(datatype) {
        var convertor;
        switch (datatype) {
            case 'FLOAT':
            case 'float':
                convertor = function(d) {
                    return parseFloat(d);
                };
                break;

            case '1-n':
            case 'INT':
            case 'INTEGER':
            case 'integer':
                convertor = function(d) {
                    return parseInt(d, 10);
                };
                break;

            case 'date/time':
            case 'DATE/TIME':
                convertor = function(d) {
                    /* required data format is YYYY-MM-DD HH:MM:SS */
                    var withSecs = /\d{4}-\d{2}-\d{2}\ \d{2}:\d{2}:\d{2}/;

                    /* here, we assume that the date format is correct, except
                     * for the seconds that are missing. so, we add the seconds.
                     * this assumption could be wrong, and this is handled
                     * during actual date parsing */
                    if (!d.match(withSecs))
                        d += ':00';

                    /* if the date format is incorrect, the following parse
                     * will return null */
                    return dcc.dateTimeFormat.parse(d);
                };
                break;

            case 'TEXT':
            case 'text':
            default:
                convertor = function(d) {
                    return d;
                };
        }
        return convertor;
    }

    /**
     * Function to handle data points that are offsets from light-out.
     *
     * <i>Note that this function modifies the dataset parameter.</i>
     *
     * @param {Object} datapoint Data point to process.
     * @param {[Object]} dataset Array which stores converted dataset.
     * @param {Function} xc Converts x-value string to numerical/date value.
     * @param {Function} yc Converts y-value string to numerical value.
     */
    function dcc_processLightoutDatapoint(datapoint, dataset, xc, yc) {
        var off, currentAnimalId = null, temp,
            xl = datapoint.get('i'), yl = datapoint.get('v'),
            xv = xc ? xc(xl) : xl,
            yv = yc ? yc(yl) : yl;

        if (isFinite(xv) || xv instanceof Date) {
            if (isFinite(yv)) {
                /* The following assumes that all of the animal
                 * measurements have already been grouped by animal ids,
                 * and that the records have already been sorted using
                 * the increment values, i.e., the measurements are in
                 * correct temporal sequence  */
                temp = datapoint.get('a');
                if (temp !== currentAnimalId) {
                    currentAnimalId = temp;
                    off = xv; /* starting a new sequence of measurement */

                    /* determine the light-out time. for now we assume that
                     * it is 7pm.
                     *
                     * @TODO Must retrieve value from centre meta-data */
                    off.setHours(19, 0, 0, 0);
                    off = off.getTime();
                }
                xv = xv.getTime();

                /* number of hours since light-out. Note that a negative
                 * value means the measurement was before light out */
                xv = (xv - off) * 2.77777778e-7;

                dataset.push({
                    m: datapoint.get('m'), /* measurement id */
                    x: xv,
                    y: yv, /* y-axis value */
                    d: new Date(datapoint.get('d')),
                    s: datapoint.get('s'), /* sex */
                    z: datapoint.get('z'), /* zygosity */
                    g: datapoint.get('g'), /* genotype */
                    a: currentAnimalId
                });
            } else {
                console.log('Measurement id \'' + datapoint.get('m') +
                    '\' for animal id \'' + datapoint.get('a') +
                    '\' has invalid measurement value \'' + yl + '\'');
            }
        } else {
            console.log('Measurement id \'' + datapoint.get('m') +
                '\' for animal id \'' + datapoint.get('a') +
                '\' has invalid increment value \'' + xl + '\'');
        }
    }

    /**
     * Pre-processes the raw data before they are used in numerical algorithms.
     *
     * <p>The visualisation module uses ExtJS store for retrieving the
     * measurements. Furthermore, the measurements returned by the web services
     * is an array of objects, all with string property value irrespective of
     * the actual type of the data. For instance, data/time increments are
     * returned as '2008-05-26 14:05:00', and floating point measurements are
     * returned as, say '3.1415'. These values must first be converted to the
     * correct types before processing them.</p>
     *
     * @param {Object} store The ExtJS store that provides the data set.
     * @param {Object} type Contains plot type, convertors and labels.
     */
    function dcc_preprocessRawData(store, type) {
        var processedDataset = [],
            /* string-to-datatype convertors for x and y-axis values */
            xc = type.xc, yc = type.yc;

        /* if it is a series and the x-axis are date/time increments, then
         * it means that the increment value should be hours since light-out.
         * Since, the recorded increment value is time, we make the necessary
         * calculations to determine the actual number of hours since the
         * light out. Note that the light-out time is cenre specific. */
        if (type.t === 'series' && type.xt === 'd') {
            store.each(function(d) {
                dcc_processLightoutDatapoint(d, processedDataset, xc, yc);
            });
        } else
            store.each(function(r) {
                var xl = r.get('i'), yl = r.get('v'),
                    xv = xc ? xc(xl) : xl,
                    yv = yc ? yc(yl) : yl;

                if (isFinite(xv) || xv instanceof Date) {
                    if (isFinite(yv)) {
                        processedDataset.push({
                            m: r.get('m'), /* measurement id */
                            x: xv, /* x-axis increments */
                            y: yv, /* y-axis value */
                            d: new Date(r.get('d')),
                            s: r.get('s'), /* sex */
                            z: r.get('z'), /* zygosity */
                            g: r.get('g'), /* genotype */
                            a: r.get('a') /* animal identifier */
                        });
                    }
                }
            });
        return processedDataset;
    }

    /**
     * Prepares the wildtype measurements for numerical calculations.
     *
     * @param {Object} store ExtJS store to use as the data source.
     * @param {Object} type Contains plot type, convertors and labels.
     */
    function dcc_processBaselineMeasurements(store, type) {
        store.clearFilter(true);
        store.filterBy(function(item) {
            return (item.get('g') === 0);
        });
        return type.t === 'nominal' ?
            Ext.pluck(store.getRange(), 'data')
            : dcc_preprocessRawData(store, type);
    }

    /**
     * Prepares the mutant measurements for numerical calculations.
     *
     * @param {Object} store ExtJS store to use as the data source.
     * @param {Object} type Contains plot type, convertors and labels.
     */
    function dcc_processMutantMeasurements(store, type) {
        store.clearFilter(true);
        store.filterBy(function(item) {
            return (item.get('g') !== 0);
        });
        return type.t === 'nominal' ?
            Ext.pluck(store.getRange(), 'data')
            : dcc_preprocessRawData(store, type);
    }

    /**
     * Determines the type of visualisation, and prepares the data for plotting.
     *
     * @param {Object} id Visualisation identifier.
     * @param {Object} type Contains plot type, convertors and labels.
     * @param {Object} store ExtJS store to use as the data source.
     * @param {String} selector DOM node selector of the visualisatin container.
     *
     * @return An array of values that can be used by the visualisation module.
     */
    dcc.visualise = function(id, type, store, selector) {
        var vizContainer = d3.select(selector), mutantDataset, baselineDataset;

        vizContainer.selectAll('svg').remove();
        vizContainer.selectAll('.vopt-controls').remove();

        if (type === null || store === null || type.t === 'noplot') {
            vizContainer.text('Unable to visualise due to unplottable data')
                .classed('no-visualisation', true);
        } else {
            if (type.t === 'meta') {
                vizContainer.text('Meta-data display is currently work-in-progress.')
                    .classed('no-visualisation', true);
            } else {
                /* if user selected wildtype, treat it as a mutant, and disable
                 * wildtype statistics. */
                if (dcc.dataContext.gid === 0) {
                    mutantDataset = dcc_processBaselineMeasurements(store, type);
                    baselineDataset = null;
                } else {
                    mutantDataset = dcc_processMutantMeasurements(store, type);
                    baselineDataset = dcc_processBaselineMeasurements(store, type);
                }
                if (mutantDataset.length < 1) {
                    vizContainer.text('No data to visualise')
                        .classed('no-visualisation', true);
                } else {
                    vizContainer.text('').classed('no-visualisation', false);
                    dcc.plot(id, type, mutantDataset,
                        baselineDataset, vizContainer);
                }
            }
        }
    };

    /**
     * Following are specification for the visualisation control.
     */
    var dcc_control_spec =
        {
            "point": {
                "control": [{
                        "t": "fieldset",
                        "i": "include_datapoints",
                        "l": "Data points to include in visualisation",
                        "c": [{
                                "t": "checkbox",
                                "l": "Include male",
                                "m": "all_male"
                            },
                            {
                                "t": "checkbox",
                                "l": "Include female",
                                "m": "all_female"
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "i": 'show_selected_data_points',
                        "l": "Highlight cited data points or selection",
                        "m": "selected"
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "i": 'show_minmax',
                        "l": "Show QC min/max range",
                        "m": "show_minmax"
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "i": "show_mutant_data_points",
                        "l": "Show data points",
                        "m": "show_all",
                        "c": [{
                                "t": "fieldset",
                                "i": "show_all_options",
                                "l": "Options for all data-sets",
                                "c": [{
                                        "t": "checkbox",
                                        "l": "Show data point",
                                        "m": "all_point"
                                    },
                                    {
                                        "t": "checkbox",
                                        "l": "Show series polyline",
                                        "m": "all_pline"
                                    }]
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "l": "Highlight selected specimen",
                        "m": "highlight",
                        "c": [{
                                "t": "fieldset",
                                "i": "highlight_options",
                                "l": "Options for highlighted data-set",
                                "c": [{
                                        "t": "checkbox",
                                        "l": "Show data point",
                                        "m": "high_point"
                                    },
                                    {
                                        "t": "checkbox",
                                        "l": "Show series polyline",
                                        "m": "high_pline"
                                    }]
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "l": "Show statistics",
                        "m": "statistics",
                        "c": [{
                                "t": "fieldset",
                                "i": "statistics_options",
                                "c": [{
                                        "t": "checkbox",
                                        "l": "Show wildtype",
                                        "m": "wildtype"
                                    }, {
                                        "t": "vspace"
                                    },
                                    {
                                        "t": "fieldset",
                                        "i": "statistics_types",
                                        "l": "Statistics type",
                                        "c": [{
                                                "t": "checkbox",
                                                "l": "Maximum",
                                                "m": "max"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Minimum",
                                                "m": "min"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Mean",
                                                "m": "mean"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Median",
                                                "m": "median"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "1st and 3rd Quartiles",
                                                "m": "quartile"
                                            }]
                                    }]
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "fieldset",
                        "i": "general_options",
                        "l": "General options",
                        "c": [{
                                "t": "checkbox",
                                "l": "Cross hair",
                                "m": "cross_hair"
                            },
                            {
                                "t": "checkbox",
                                "l": "X-axis and label",
                                "m": "x_axis_label"
                            },
                            {
                                "t": "checkbox",
                                "l": "Y-axis and label",
                                "m": "y_axis_label"
                            }]
                    }]
            },
            "series": {
                "control": [{
                        "t": "fieldset",
                        "i": "include_datapoints",
                        "l": "Data points to include in visualisation",
                        "c": [{
                                "t": "checkbox",
                                "l": "Include male",
                                "m": "all_male"
                            },
                            {
                                "t": "checkbox",
                                "l": "Include female",
                                "m": "all_female"
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "i": 'show_selected_data_points',
                        "l": "Highlight cited data points or selection",
                        "m": "selected"
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "i": 'show_minmax',
                        "l": "Show QC min/max range",
                        "m": "show_minmax"
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "i": "show_mutant_data_points",
                        "l": "Show data points",
                        "m": "show_all",
                        "c": [{
                                "t": "fieldset",
                                "i": "show_all_options",
                                "l": "Options for all data-sets",
                                "c": [{
                                        "t": "checkbox",
                                        "l": "Show data point",
                                        "m": "all_point"
                                    },
                                    {
                                        "t": "checkbox",
                                        "l": "Show series polyline",
                                        "m": "all_pline"
                                    }]
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "l": "Highlight selected specimen",
                        "m": "highlight",
                        "c": [{
                                "t": "fieldset",
                                "i": "highlight_options",
                                "l": "Options for highlighted data-set",
                                "c": [{
                                        "t": "checkbox",
                                        "l": "Show data point",
                                        "m": "high_point"
                                    },
                                    {
                                        "t": "checkbox",
                                        "l": "Show series polyline",
                                        "m": "high_pline"
                                    }]
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "checkbox",
                        "l": "Show statistics",
                        "m": "statistics",
                        "c": [{
                                "t": "fieldset",
                                "i": "statistics_options",
                                "c": [{
                                        "t": "checkbox",
                                        "l": "Show wildtype",
                                        "m": "wildtype"
                                    }, {
                                        "t": "fieldset",
                                        "i": "statistics_visuals",
                                        "l": "Options for statistics visualisation",
                                        "c": [{
                                                "t": "checkbox",
                                                "l": "Show data point",
                                                "m": "stat_point"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Show series polyline",
                                                "m": "stat_pline"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Extend Whiskers to 1.5 IQR",
                                                "m": "use_iqr"
                                            }]
                                    }, {
                                        "t": "vspace"
                                    },
                                    {
                                        "t": "fieldset",
                                        "i": "statistics_types",
                                        "l": "Statistics type",
                                        "c": [{
                                                "t": "checkbox",
                                                "l": "Box-plot with whiskers",
                                                "m": "whisker"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Maximum",
                                                "m": "max"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Minimum",
                                                "m": "min"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Mean",
                                                "m": "mean"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Median",
                                                "m": "median"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "1st and 3rd Quartiles",
                                                "m": "quartile"
                                            },
                                            {
                                                "t": "checkbox",
                                                "l": "Standard error",
                                                "m": "std_error"
                                            }]
                                    }]
                            }]
                    },
                    {
                        "t": "vspace"
                    },
                    {
                        "t": "fieldset",
                        "i": "general_options",
                        "l": "General options",
                        "c": [{
                                "t": "checkbox",
                                "l": "Cross hair",
                                "m": "cross_hair"
                            },
                            {
                                "t": "checkbox",
                                "l": "X-axis and label",
                                "m": "x_axis_label"
                            },
                            {
                                "t": "checkbox",
                                "l": "Y-axis and label",
                                "m": "y_axis_label"
                            }]
                    }]
            },
            "nominal": {
                "control": []
            }
        };


    /* Displaying the data context history timeline. */

    function getWindowX(event) {
        return event.pageX !== undefined
            ? event.pageX : event.clientX;
    }

    function getWindowY(event) {
        return event.pageY !== undefined
            ? event.pageY : event.clientY;
    }

    function getEvent(event) {
        if (!event)
            event = window.event;
        return event;
    }

    function Popup(parent) {
        this.parent = parent;
        this.init();
    }

    Popup.prototype = {
        init: function() {
            var me = this,
                popup = me.parent.append('div')
                .attr('class', 'timeline-popup')
                .style('visibility', 'hidden');
            me.popup = popup;
        },
        update: function(content) {
            var me = this;
            me.popup.html(content);
        },
        show: function() {
            var me = this;
            me.popup.style('visibility', 'visible');
        },
        hide: function() {
            var me = this;
            me.popup.style('visibility', 'hidden');
        },
        move: function(event) {
            var me = this, displacement = 6;
            event = getEvent(event);
            me.popup.style('left', getWindowX(event) + displacement + 'px');
            me.popup.style('top', getWindowY(event) + displacement + 'px');
        }
    };

    dcc.timeline = function(history, container) {
        var data = [], key, entry, timeline, popup,
            container = d3.select(container);
        container.select('table').remove();
        if (history === null)
            return;
        timeline = container.append('table');
        for (key in history) {
            entry = history[key];
            data.push({
                'user': entry.u,
                'when': new Date(entry.w),
                'type': entry.t,
                'state': entry.s,
                'issue': entry.r,
                'action': entry.a
            });
        }
        popup = new Popup(timeline);
        drawLabels(timeline, data, -1, 'user');
        drawMarkers(timeline, data, -1, popup);
        drawLabels(timeline, data, -1, 'when');
    };

    function drawLabels(timeline, data, inc, type) {
        var count = data.length, start = inc > 0 ? 0 : count - 1,
            cls = 'timeline-' + type,
            tr = timeline.append('tr').attr('class', cls);
        tr.append('td');
        while (count--) {
            tr.append('td').attr('class', cls).text(data[start][type]);
            start += inc;
        }
    }

    function drawMarkers(timeline, data, inc, popup) {
        var count = data.length, currentDate = null,
            start = inc > 0 ? 0 : count - 1,
            tr = timeline.append('tr').attr('class', 'marker');
        tr.append('td').append('div').attr('class', 'project-end').text('Now');
        while (count--) {
            currentDate = drawMarker(tr, data[start], currentDate, popup);
            start += inc;
        }
        tr.append('td').append('div').attr('class', 'project-start').text('Before data');
    }

    function getMarkerOnClickHandler(issue) {
        var controller = dcc.extjs.controller,
            tab = controller.getIssueSpecimenHistoryTab();
        return function() {
            dcc.dataContext.iid = issue;
            controller.loadIssues();
            tab.setActiveTab(0);
        };
    }

    function getActionType(entry) {
        switch (entry.type) {
            case 'adddata':
                return 'Added measurements';
            case 'removedata':
                return 'Removed measurements';
            case 'changedata':
                return 'Modified measurements';
            case 'raise':
                return 'Raised new issue';
            case 'comment':
                return 'Commented on issue';
            case 'accept':
                return 'Working on a fix for issue';
            case 'resolve':
                return 'Resolved issue';
            case 'qcdone':
                return 'Finished quality control';
            default:
                return 'Unknown action!';
        }
    }
    function getMarkerOnMouseOverHandler(entry, popup) {
        var controller = dcc.extjs.controller,
            store = controller.getIssuesStore();
        return function() {
            var msg = '<span class="timeline-popup-title">'
                + getActionType(entry) + '</span>', record, issue;
            if (entry.issue !== -1) {
                msg += '<p>';
                issue = entry.issue;
                record = store.findRecord('id', issue);
                if (record === null)
                    msg += 'Issue ' + issue + ' does not have a title!';
                else
                    msg += record.get('title');
                msg += '</p>';
            }
            popup.update(msg);
            popup.show();
        };
    }

    function drawMarker(tr, entry, currentDate, popup) {
        var date = entry.when, actionDate = date.getFullYear(), cls, marker;

        if (currentDate === null)
            currentDate = actionDate;
        else {
            if (currentDate !== actionDate) {
                cls = "new-year";
                currentDate = actionDate;
            }
        }
        marker = tr.append('td').attr('class', cls)
            .append('div').attr('class', 'timeline-action-' + entry.type);

        marker.on('mouseover', getMarkerOnMouseOverHandler(entry, popup));
        marker.on('mouseout', function() {
            popup.hide();
        });
        marker.on('mousemove', function(event) {
            popup.move(event);
        });

        if (entry.issue !== -1)
            marker.on('click', getMarkerOnClickHandler(entry.issue));

        return currentDate;
    }

})();