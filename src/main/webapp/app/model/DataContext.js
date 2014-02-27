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
Ext.define('PhenoDCC.model.DataContext', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'id',
        type: 'int'
    },
    {
        name: 'cid',
        type: 'int'
    },
    {
        name: 'lid',
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
        name: 'pid',
        type: 'int'
    },
    {
        name: 'qid',
        type: 'int'
    },
    {
        name: 'numIssues',
        type: 'int'
    },
    {
        name: 'numResolved',
        type: 'int'
    },
    {
        name: 'numMeasurements',
        type: 'int'
    },
    {
        name: 'stateId',
        type: 'Object'
    }
    ],
    associations: [
    /* A data context can have many issues.
     * Every issue belongs to one and only one data context.
     */
    {
        type: 'hasMany',
        model: 'Issue',
        primaryKey: 'id', /* primary key in the Issue model */
        foreignKey: 'contexId' /* associated foreign key in the Issue model */
    },

    /* Every data context belongs to one and only one centre.
     * An centre can have many data contexts.
     */
    {
        type: 'belongsTo',
        model: 'Centre',
        associationKey: 'cid' /* associated foreign key field in this model */
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/datacontexts/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'datacontexts',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
