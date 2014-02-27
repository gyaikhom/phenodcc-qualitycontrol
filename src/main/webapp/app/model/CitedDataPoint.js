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
Ext.define('PhenoDCC.model.CitedDataPoint', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'id',
        type: 'int'
    },
    {
        name: 'a', /* animal id */
        type: 'int'
    },
    {
        name: 'm', /* measurement id */
        type: 'int'
    }
    ],
    associations: [
    /* Every cited data-point belongs to one and only one issue.
     * An issue can have many cited data-points.
     */
    {
        type: 'belongsTo',
        model: 'Issue',
        associationKey: 'issueId' /* associated foreign key field in this model */
    },

    /* An issue can have many cited data-points.
     * Every cited data-point belongs to one and only one issue.
     */
    {
        type: 'hasMany',
        model: 'CitedDataPoint',
        primaryKey: 'id', /* primary key in the CitedDataPoint model */
        foreignKey: 'issueId' /* associated foreign key in the CitedDataPoint model */
    },
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/citeddatapoints',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'citeddatapoints',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
