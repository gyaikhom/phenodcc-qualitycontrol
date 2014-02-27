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
Ext.define('PhenoDCC.model.GeneStrain', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'cid',
        type: 'int'
    },

    {
        name: 'gid',
        type: 'int'
    },

    {
        name: 'sid',
        type: 'int'
    },

    {
        name: 'geneSymbol',
        type: 'String'
    },

    {
        name: 'geneId',
        type: 'String'
    },

    {
        name: 'geneName',
        type: 'String'
    },

    {
        name: 'alleleName',
        type: 'String'
    },

    {
        name: 'strain',
        type: 'String'
    },

    {
        name: 'genotype',
        type: 'String'
    },

    {
        name: 'stateId',
        type: 'int'
    },
    {
        name: 'numUnresolved',
        type: 'int'
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/genestrains/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            totalProperty: 'total',
            root: 'genestrains'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
