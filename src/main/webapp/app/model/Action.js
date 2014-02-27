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
Ext.define('PhenoDCC.model.Action', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'id',
        type: 'int'
    },
    {
        name: 'issueId',
        type: 'int'
    },
    {
        name: 'description',
        type: 'string'
    },
    {
        name: 'actionType'
    },
    {
        name: 'actionedBy'
    },
    {
        name: 'lastUpdate',
        type: 'date',
        dateFormat: 'time'
    }
    ],
    associations: [
    /* Every action belongs to one and only one action type.
     * An action type can have many actions.
     */
    {
        type: 'belongsTo',
        model: 'ActionType',
        associationKey: 'actionType' /* associated foreign key field in this model */
    },

    /* Every action belongs to one and only one user.
     * A user can have many actions.
     */
    {
        type: 'belongsTo',
        model: 'User',
        associationKey: 'actionedBy' /* associated foreign key field in this model */
    },

    /* Every action belongs to one and only one issue.
     * An issue can have many actions.
     */
    {
        type: 'belongsTo',
        model: 'Issue',
        associationKey: 'issueId' /* associated foreign key field in this model */
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/actions/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'actions',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
