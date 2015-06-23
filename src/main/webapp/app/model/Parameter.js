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
Ext.define('PhenoDCC.model.Parameter', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'i',
        type: 'int'
    },
    {
        name: 'e',
        type: 'string'
    },
    {
        name: 'n',
        type: 'string'
    },
    {
        name: 'p',
        type: 'int'
    },
    {
        name: 's',
        type: 'int'
    },
    {
        name: 't',
        type: 'int'
    },
    {
        name: 'd',
        type: 'string'
    },
    {
        name: 'u',
        type: 'string'
    },
    {
        name: 'ii',
        type: 'int'
    },
    {
        name: 'iv',
        type: 'string'
    },
    {
        name: 'it',
        type: 'string'
    },
    {
        name: 'iu',
        type: 'string'
    },
    {
        name: 'im',
        type: 'string'
    },
    {
        name: 'c',
        type: 'int'
    },
    {
        name: 'q',
        type: 'int'
    },
    {
        name: 'ur',
        type: 'int'
    },
    {
        name: 'qb',
        type: 'int'
    },
    {
        name: 'qm',
        type: 'float'
    },
    {
        name: 'qM',
        type: 'float'
    },
    {
        name: 'r',
        type: 'int'
    },
    {
        name: 'o',
        type: 'Array'
    }
    ],
    requires: [
        'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/parameters/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'parameters',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
