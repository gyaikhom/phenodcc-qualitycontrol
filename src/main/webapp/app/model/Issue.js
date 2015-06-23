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
Ext.define('PhenoDCC.model.Issue', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'id',
        type: 'int'
    },
    {
        name: 'title'
    },
    {
        name: 'description'
    },
    {
        name: 'priority'
    },
    {
        name: 'controlSetting',
        type: 'int'
    },
    {
        name: 'status'
    },
    {
        name: 'contextId'
    },
    {
        name: 'datapoints',
        type: 'Array'
    },
    {
        name: 'raisedBy'
    },
    {
        name: 'raisedByUid',
        type: 'int'
    },
    {
        name: 'assignedTo'
    },
    {
        name: 'lastUpdate',
        type: 'date',
        dateFormat: 'time'
    }],
    associations: [
    /* An issue can have many actions.
     * Every action belongs to one and only one issue.
     */
    {
        type: 'hasMany',
        model: 'Action',
        primaryKey: 'id', /* primary key in the Action model */
        foreignKey: 'issueId' /* associated foreign key in the Action model */
    },

    /* Every issue belongs to one and only one issue status.
     * An issue status can have many issues in that status.
     */
    {
        type: 'belongsTo',
        model: 'IssueStatus',
        associationKey: 'status' /* associated foreign key field in this model */
    },

    /* Every issue belongs to one and only one user (the issue handler).
     * An issue handler can have many issues.
     */
    {
        type: 'belongsTo',
        model: 'User',
        associationKey: 'assignedTo' /* associated foreign key field in this model */
    },

    /* Every issue belongs to one and only one data context.
     * An data context can have many issues.
     */
    {
        type: 'belongsTo',
        model: 'DataContext',
        associationKey: 'contextId' /* associated foreign key field in this model */
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'issues',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
