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
import org.mousephenotype.dcc.entities.qc.DataContext;
import org.mousephenotype.dcc.entities.qc.IssueStatus;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Entity
public class AnIssueRequest implements Serializable {

    private static final long serialVersionUID = 1L;
    @Id
    private Long id;
    private Short priority;
    private Integer controlSetting;
    private Integer status;
    private Long contextId;
    private String raisedBy;
    private Integer raisedByUid;
    private Integer assignedTo;
    private Long lastUpdate;
    private String title;
    private String description;
    private Integer[] datapoints;
    
    /* the following must match consistent identifiers in the database */
    private static final Integer RAISE_ISSUE = 0;

    public AnIssueRequest() {
    }

    private IssueStatus getIssueStatus(EntityManager em, Integer status) {
        TypedQuery<IssueStatus> query =
                em.createNamedQuery("IssueStatus.findByCid", IssueStatus.class);
        query.setParameter("cid", status);
        return query.getSingleResult();
    }

    public AnIssue getIssue(EntityManager em) {
        AnIssue issue = new AnIssue();
        issue.setContextId(em.find(DataContext.class, contextId));
        issue.setTitle(title);
        issue.setPriority(priority);
        issue.setControlSetting(controlSetting);
        issue.setStatus(getIssueStatus(em, status));
        issue.setRaisedBy(raisedByUid);
        issue.setAssignedTo(assignedTo);
        issue.setIsDeleted(0);
        return issue;
    }

    private ActionType getActionType(EntityManager em, Integer type) {
        TypedQuery<ActionType> q = em.createNamedQuery(
                "ActionType.findByCid", ActionType.class);
        q.setParameter("cid", type);
        q.setMaxResults(1);
        return q.getSingleResult();
    }

    public AnAction getAction(EntityManager em) {
        AnAction action = new AnAction();
        action.setDescription(description);
        action.setActionType(getActionType(em, RAISE_ISSUE));
        action.setActionedBy(raisedByUid);
        return action;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Short getPriority() {
        return priority;
    }

    public void setPriority(Short priority) {
        this.priority = priority;
    }

    public Integer getControlSetting() {
        return controlSetting;
    }

    public void setControlSetting(Integer controlSetting) {
        this.controlSetting = controlSetting;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public Long getContextId() {
        return contextId;
    }

    public void setContextId(Long contextId) {
        this.contextId = contextId;
    }

    public Integer[] getDatapoints() {
        return datapoints;
    }

    public void setDatapoints(Integer[] datapoints) {
        this.datapoints = datapoints;
    }

    public String getRaisedBy() {
        return raisedBy;
    }

    public void setRaisedBy(String raisedBy) {
        this.raisedBy = raisedBy;
    }

    public Integer getRaisedByUid() {
        return raisedByUid;
    }

    public void setRaisedByUid(Integer raisedByUid) {
        this.raisedByUid = raisedByUid;
    }

    public Integer getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(Integer assignedTo) {
        this.assignedTo = assignedTo;
    }

    public Long getLastUpdate() {
        return lastUpdate;
    }

    public void setLastUpdate(Long lastUpdate) {
        this.lastUpdate = lastUpdate;
    }
}