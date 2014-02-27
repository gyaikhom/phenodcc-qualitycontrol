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
Ext.define('PhenoDCC.model.Specimen', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'id',
        type: 'int'
    },
    {
        name: 'aid',
        type: 'int'
    },
    {
        name: 'name',
        type: 'string'
    },
    {
        name: 'coid',
        type: 'int'
    },
    {
        name: 'cohort',
        type: 'int'
    },
    {
        name: 'sex',
        type: 'boolean'
    },
    {
        name: 'homozygous',
        type: 'boolean'
    },
    {
        name: 'dob',
        type: 'date',
        dateFormat: 'time'
    },
    {
        name: 'cid',
        type: 'int'
    },
    {
        name: 'gid',
        type: 'int'
    },
    {
        name: 'genotype',
        type: 'string'
    },
    {
        name: 'sid',
        type: 'int'
    },
    {
        name: 'pipeline',
        type: 'int'
    },
    {
        name: 'litter',
        type: 'string'
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/specimens/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'specimens',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
