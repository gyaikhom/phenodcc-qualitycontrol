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
Ext.define('PhenoDCC.model.ProcedureSpecimen', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'ai',
        type: 'int'
    },
    {
        name: 'oi',
        type: 'int'
    },
    {
        name: 'n',
        type: 'string'
    },
    {
        name: 'c',
        type: 'string'
    },
    {
        name: 's',
        type: 'int'
    },
    {
        name: 'z',
        type: 'int'
    },
    {
        name: 'd',
        type: 'date',
        dateFormat: 'time'
    },
    {
        name: 'l',
        type: 'string'
    },
    {
        name: 'p',
        type: 'string'
    },
    {
        name: 'e',
        type: 'string'
    },
    {
        name: 'sd',
        type: 'date',
        dateFormat: 'time'
    },
    {
        name: 'en',
        type: 'string'
    },
    {
        name: 'em',
        type: 'string'
    },
    {
        name: 'et',
        type: 'string'
    }
    ],
    requires: [
        'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/procedurespecimens/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'procedurespecimens',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
