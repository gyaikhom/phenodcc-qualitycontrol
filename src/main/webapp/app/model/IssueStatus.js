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
Ext.define('PhenoDCC.model.IssueStatus', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'id',
        type: 'int'
    },
    {
        name: 'shortName',
        type: 'string'
    },
    {
        name: 'description',
        type: 'string'
    },
    {
        name: 'lastUpdate',
        type: 'date',
        dateFormat: 'time'
    }
    ],
    associations: [
    /* An issue status can have many issues that are currently in that status.
     * Every issue belongs to one and only one issue status.
     */
    {
        type: 'hasMany',
        model: 'Issue',
        primaryKey: 'id', /* primary key in the Issue model */
        foreignKey: 'status' /* associated foreign key in the Issue model */
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/issuestatuses/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'issuestatuses',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
