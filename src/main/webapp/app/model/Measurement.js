/*
 * Copyright 2012 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
Ext.define('PhenoDCC.model.Measurement', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'm', /* measurement Id */
        type: 'int'
    },
    {
        name: 'a', /* animal Id */
        type: 'int'
    },
    {
        name: 'g', /* genotype: for separating wildtype from mutant */
        type: 'int'
    },
    {
        name: 's', /* sex */
        type: 'int'
    },
    {
        name: 'z', /* zygosity */
        type: 'int'
    },
    {
        name: 'd', /* experiment start date */
        type: 'time'
    },
    {
        name: 'i', /* measurement increment */
        type: 'string'
    },
    {
        name: 'v', /* measured value */
        type: 'string'
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/measurements/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'measurements',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
