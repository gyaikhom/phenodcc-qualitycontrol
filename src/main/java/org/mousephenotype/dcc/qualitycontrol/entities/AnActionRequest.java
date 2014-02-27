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
package org.mousephenotype.dcc.qualitycontrol.entities;

import java.io.Serializable;
import javax.persistence.Entity;
import javax.persistence.EntityManager;
import javax.persistence.Id;
import javax.persistence.TypedQuery;
import org.mousephenotype.dcc.entities.qc.ActionType;
import org.mousephenotype.dcc.entities.qc.AnAction;
import org.mousephenotype.dcc.entities.qc.AnIssue;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Entity
public class AnActionRequest implements Serializable {

    private static final long serialVersionUID = 1L;
    @Id
    private Long id;
    private String description;
    private Integer actionedBy;
    private Integer actionType;
    private Long issueId;
    private Long lastUpdate;

    public AnActionRequest() {
    }

    public AnActionRequest(Long id, String description,
            Integer actionedBy, Integer actionType, Long issueId) {
        this.id = id;
        this.description = description;
        this.actionedBy = actionedBy;
        this.actionType = actionType;
        this.issueId = issueId;
    }

    private ActionType getActionType(EntityManager em, Integer actionType) {
        TypedQuery<ActionType> query =
                em.createNamedQuery("ActionType.findByCid",
                ActionType.class);
        query.setParameter("cid", actionType);
        return query.getSingleResult();
    }

    public AnAction getAction(EntityManager em) {
        AnAction action = new AnAction();
        action.setDescription(description);
        action.setActionType(getActionType(em, actionType));
        action.setActionedBy(actionedBy);
        action.setIssueId(em.find(AnIssue.class, issueId));
        return action;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getActionedBy() {
        return actionedBy;
    }

    public void setActionedBy(Integer actionedBy) {
        this.actionedBy = actionedBy;
    }

    public Integer getActionType() {
        return actionType;
    }

    public void setActionType(Integer actionType) {
        this.actionType = actionType;
    }

    public Long getIssueId() {
        return issueId;
    }

    public void setIssueId(Long issueId) {
        this.issueId = issueId;
    }

    public Long getLastUpdate() {
        return lastUpdate;
    }

    public void setLastUpdate(Long lastUpdate) {
        this.lastUpdate = lastUpdate;
    }
}