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
package org.mousephenotype.dcc.qualitycontrol.webservice;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.codehaus.jettison.json.JSONArray;
import org.codehaus.jettison.json.JSONException;
import org.codehaus.jettison.json.JSONObject;
import org.eclipse.persistence.exceptions.DatabaseException;
import org.mousephenotype.dcc.entities.impress.Parameter;
import org.mousephenotype.dcc.entities.impress.Procedure;
import org.mousephenotype.dcc.entities.overviews.MeasurementsPerformed;
import org.mousephenotype.dcc.entities.qc.AState;
import org.mousephenotype.dcc.entities.qc.AUser;
import org.mousephenotype.dcc.entities.qc.AnAction;
import org.mousephenotype.dcc.entities.qc.AnIssue;
import org.mousephenotype.dcc.entities.qc.CitedDataPoint;
import org.mousephenotype.dcc.entities.qc.DataContext;
import org.mousephenotype.dcc.entities.qc.History;
import org.mousephenotype.dcc.qualitycontrol.entities.AnIssueRequest;
import org.mousephenotype.dcc.qualitycontrol.entities.AnIssueResponse;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.AnIssuePack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("issues")
public class AnIssueFacadeREST extends AbstractFacade<AnIssue> {

    private static final String CID = "cid"; // centre id
    private static final String LID = "lid"; // pipeline id
    private static final String GID = "gid"; // genotype id
    private static final String SID = "sid"; // strain id
    private static final String PID = "pid"; // procedure id
    private static final String QID = "qid"; // parameter id
    private static final String NAME = "name"; // name (procedure/parameter)
    private static final String KEY = "parameterKey"; // parameter key
    private static final String NUM_MEASUREMENTS = "numMeasurements";
    private static final String ISSUE_STATUS = "status";

    /* These must match the values in the web-app (Viewport.js) */
    private static final Integer INCLUDE_NEW_ISSUES = 0x1;
    private static final Integer INCLUDE_ACCEPTED_ISSUES = 0x2;
    private static final Integer INCLUDE_RESOLVED_ISSUES = 0x4;
    private static final Integer INCLUDE_DATAADDED_ISSUES = 0x8;
    private static final Integer INCLUDE_DATAREMOVED_ISSUES = 0x10;
    private static final Integer INCLUDE_DATACHANGED_ISSUES = 0x20;
    private static final Integer INCLUDE_NODATA_ISSUES = 0x40;

    /* Thes are consistent identifiers (cid) from phenodcc_qc.issue_status */
    private static final Integer NEW_ISSUE = 0;
    private static final Integer ACCEPTED_ISSUE = 1;
    private static final Integer RESOLVED_ISSUE = 4;
    private static final Integer DATAADDED_ISSUE = 6;
    private static final Integer DATAREMOVED_ISSUE = 7;
    private static final Integer DATACHANGED_ISSUE = 8;

    /* the following must match consistent identifiers in the database */
    private static final int HAS_ISSUES = 5;

    public AnIssueFacadeREST() {
        super(AnIssue.class);
    }

    private MeasurementsPerformed getMeasurementPerformed(
            Integer measurementId, DataContext context) {
        EntityManager em = getEntityManager();
        Parameter p = em.find(Parameter.class, context.getQid());
        TypedQuery<MeasurementsPerformed> query
                = em.createNamedQuery("MeasurementsPerformed.findByMeasurementIdContext",
                        MeasurementsPerformed.class);
        query.setParameter("measurementId", measurementId);
        query.setParameter(CID, context.getCid());
        query.setParameter(GID, context.getGid());
        query.setParameter(SID, context.getSid());
        query.setParameter("qeid", p.getParameterKey());
        MeasurementsPerformed returnValue = query.getSingleResult();
        em.close();
        return returnValue;
    }

    private AState getState(EntityManager em, int state) {
        TypedQuery<AState> q = em.createNamedQuery("AState.findByCid",
                AState.class);
        q.setParameter("cid", state);
        q.setMaxResults(1);
        return q.getSingleResult();
    }

    @POST
    @Path("{id}")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public AnIssue createIssue(AnIssueRequest entity,
            @PathParam("id") Long contextId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnIssue issue;
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            issue = entity.getIssue(em);
            AnAction action = entity.getAction(em);
            DataContext context = issue.getContextId();
            AState newState = getState(em, HAS_ISSUES);

            try {
                em.getTransaction().begin();
                context.setNumIssues(context.getNumIssues() + 1);
                em.persist(issue);
                em.flush();
                em.refresh(issue);
                action.setIssueId(issue);
                em.persist(action);
                em.flush();
                em.refresh(action);
                em.persist(new History(context, userId, action.getActionType(),
                        newState, action, issue));

                Integer[] measurementIds = entity.getDatapoints();
                if (measurementIds != null && measurementIds.length > 0) {
                    for (int i = 0, c = measurementIds.length; i < c; ++i) {
                        MeasurementsPerformed m
                                = getMeasurementPerformed(measurementIds[i], context);
                        CitedDataPoint d
                                = new CitedDataPoint(issue, m.getMeasurementId(), m.getAnimalId());
                        em.persist(d);
                        em.flush();
                        em.refresh(d);
                    }
                }
                em.getTransaction().commit();
            } catch (DatabaseException e) {
                issue = null;
            }
            em.close();
        } else {
            issue = null;
        }
        return issue;
    }

    private Integer getAnimalId(EntityManager em, Long measurementId) {
        Integer animalId = 0;
        TypedQuery<MeasurementsPerformed> q
                = em.createNamedQuery("MeasurementsPerformed.findByMeasurementId",
                        MeasurementsPerformed.class);
        q.setParameter("measurementId", measurementId);
        q.setMaxResults(1);
        try {
            List<MeasurementsPerformed> r = q.getResultList();
            if (!r.isEmpty()) {
                animalId = r.get(0).getAnimalId();
            }
        } catch (Exception e) {
        }
        return animalId;
    }

    private AUser getUser(Integer id) {
        EntityManager em = getDrupalEntityManager();
        AUser r = null;
        try {
            r = em.find(AUser.class, id);
        } catch (Exception e) {
            System.err.println("Unable to find user with id "
                    + id + " in Drupal database.");
        } finally {
            em.close();
        }
        return r;
    }

    private Procedure getProcedure(Integer id, EntityManager em) {
        Procedure p = null;
        try {
            p = em.find(Procedure.class, id);
        } catch (Exception e) {
            System.err.println("Unable to find procedure with id "
                    + id + " in impress database.");
        }
        return p;
    }

    private Parameter getParameter(Integer id, EntityManager em) {
        Parameter q = null;
        try {
            q = em.find(Parameter.class, id);
        } catch (Exception e) {
            System.err.println("Unable to find parameter with id "
                    + id + " in impress database.");
        }
        return q;
    }

    private AnIssueResponse prepareIssueResponse(AnIssue issue) {
        AnIssueResponse r = null;
        EntityManager em = getEntityManager();
        if (issue != null) {
            TypedQuery<AnAction> actionQuery
                    = em.createNamedQuery("AnAction.findByIssueId",
                            AnAction.class);
            actionQuery.setParameter("issueId", issue);
            List<AnAction> actions = actionQuery.getResultList();
            AnAction action = actions.get(0);
            DataContext dc = issue.getContextId();
            Procedure p = getProcedure(dc.getPid(), em);
            Parameter q = getParameter(dc.getQid(), em);
            AUser raisedBy = getUser(issue.getRaisedBy());
            AUser assignedTo = getUser(issue.getAssignedTo());

            if (p == null || q == null
                    || raisedBy == null || assignedTo == null) {
                System.err.println("Failed to retrieve issue details from database");
            } else {
                r = new AnIssueResponse(
                        issue.getId(), issue.getTitle(),
                        action.getDescription(), issue.getPriorityString(),
                        issue.getControlSetting(),
                        issue.getStatus().getShortName(),
                        raisedBy.toString(), raisedBy.getUid(),
                        assignedTo.toString(),
                        issue.getLastUpdate().getTime(), dc,
                        p.getProcedureKey(), p.getName(),
                        q.getParameterKey(), q.getName());
            }
        }
        em.close();
        return r;
    }

    @GET
    @Path("extjs/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public AnIssuePack extjsFind(
            @PathParam("id") Long id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnIssuePack p = new AnIssuePack();
        if (isValidSession(sessionId, userId)) {
            AnIssue issue = super.find(id);
            if (issue == null) {
                p.setDataSet(null, 0L);
            } else {
                ArrayList<AnIssueResponse> t = new ArrayList<>();
                t.add(prepareIssueResponse(issue));
                p.setDataSet(t);
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    private List<AnIssue> getIssues(
            Integer cid,
            Integer lid,
            Integer gid,
            Integer sid,
            Integer pid,
            Integer qid,
            String orderBy,
            String orderDir,
            Integer start,
            Integer limit,
            Integer filter) {
        List<AnIssue> issues = null;

        EntityManager em = getEntityManager();
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<AnIssue> cq = cb.createQuery(AnIssue.class);
        Root<DataContext> dc = cq.from(DataContext.class);
        Root<AnIssue> i = cq.from(AnIssue.class);
        Root<Procedure> pq = cq.from(Procedure.class);
        Root<Parameter> qq = cq.from(Parameter.class);

        Predicate p = cb.equal(dc.get(CID), cid);
        if (lid != null && lid != -1) {
            p = cb.and(p, cb.equal(i.get(LID), lid));
            if (gid != null && gid != -1) {
                p = cb.and(p, cb.equal(dc.get(GID), gid));
                if (sid != null && sid != -1) {
                    p = cb.and(p, cb.equal(dc.get(SID), sid));
                    if (pid != null && pid != -1) {
                        p = cb.and(p, cb.equal(dc.get(PID), pid));
                        if (qid != null && qid != -1) {
                            p = cb.and(p, cb.equal(dc.get(QID), qid));
                        }
                    }
                }
            }
        }
        p = cb.and(p, cb.equal(i.get("isDeleted"), 0));
        p = cb.and(p, cb.equal(dc, i.get("contextId")));
        p = cb.and(p, cb.equal(dc.get(PID), pq.get("procedureId")));
        p = cb.and(p, cb.equal(dc.get(QID), qq.get("parameterId")));

        if (filter != 0x0) {
            if ((filter & INCLUDE_NODATA_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(dc.get(NUM_MEASUREMENTS), 0));
            }
            if ((filter & INCLUDE_NEW_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), NEW_ISSUE));
            }
            if ((filter & INCLUDE_ACCEPTED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), ACCEPTED_ISSUE));
            }
            if ((filter & INCLUDE_RESOLVED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), RESOLVED_ISSUE));
            }
            if ((filter & INCLUDE_DATAADDED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), DATAADDED_ISSUE));
            }
            if ((filter & INCLUDE_DATAREMOVED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), DATAREMOVED_ISSUE));
            }
            if ((filter & INCLUDE_DATACHANGED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), DATACHANGED_ISSUE));
            }
        }

        cq.where(p);

        if (orderBy != null && orderBy.length() > 0) {
            switch (orderBy) {
                case "procedure":
                    if ("ASC".equals(orderDir)) {
                        cq.orderBy(cb.asc(pq.get(NAME)));
                    } else {
                        cq.orderBy(cb.desc(pq.get(NAME)));
                    }
                    break;
                case "parameter":
                    if ("ASC".equals(orderDir)) {
                        cq.orderBy(cb.asc(qq.get(NAME)));
                    } else {
                        cq.orderBy(cb.desc(qq.get(NAME)));
                    }
                    break;
                case "qeid":
                    if ("ASC".equals(orderDir)) {
                        cq.orderBy(cb.asc(qq.get(KEY)));
                    } else {
                        cq.orderBy(cb.desc(qq.get(KEY)));
                    }
                    break;
                default:
                    if ("ASC".equals(orderDir)) {
                        cq.orderBy(cb.asc(i.get(orderBy)));
                    } else {
                        cq.orderBy(cb.desc(i.get(orderBy)));
                    }
                    break;
            }
        }

        TypedQuery<AnIssue> contextQuery = em.createQuery(cq);
        try {
            if (start != null && start != -1) {
                contextQuery.setFirstResult(start);
            }
            if (limit != null && limit != -1) {
                contextQuery.setMaxResults(limit);
            }

            issues = contextQuery.getResultList();
        } catch (Exception e) {
        }
        em.close();
        return issues;
    }

    private Long countTotalIssues(
            Integer cid,
            Integer lid,
            Integer gid,
            Integer sid,
            Integer pid,
            Integer qid,
            Integer filter) {
        Long count = 0L;

        EntityManager em = getEntityManager();
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Long> cq = cb.createQuery(Long.class);
        Root<DataContext> dc = cq.from(DataContext.class);
        Root<AnIssue> i = cq.from(AnIssue.class);
        Root<Procedure> pq = cq.from(Procedure.class);
        Root<Parameter> qq = cq.from(Parameter.class);

        Predicate p = cb.equal(dc.get(CID), cid);
        if (lid != null && lid != -1) {
            p = cb.and(p, cb.equal(i.get(LID), lid));
            if (gid != null && gid != -1) {
                p = cb.and(p, cb.equal(dc.get(GID), gid));
                if (sid != null && sid != -1) {
                    p = cb.and(p, cb.equal(dc.get(SID), sid));
                    if (pid != null && pid != -1) {
                        p = cb.and(p, cb.equal(dc.get(PID), pid));
                        if (qid != null && qid != -1) {
                            p = cb.and(p, cb.equal(dc.get(QID), qid));
                        }
                    }
                }
            }
        }
        p = cb.and(p, cb.equal(i.get("isDeleted"), 0));
        p = cb.and(p, cb.equal(dc, i.get("contextId")));
        p = cb.and(p, cb.equal(dc.get(PID), pq.get("procedureId")));
        p = cb.and(p, cb.equal(dc.get(QID), qq.get("parameterId")));

        if (filter != 0x0) {
            if ((filter & INCLUDE_NODATA_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(dc.get(NUM_MEASUREMENTS), 0));
            }
            if ((filter & INCLUDE_NEW_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), NEW_ISSUE));
            }
            if ((filter & INCLUDE_ACCEPTED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), ACCEPTED_ISSUE));
            }
            if ((filter & INCLUDE_RESOLVED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), RESOLVED_ISSUE));
            }
            if ((filter & INCLUDE_DATAADDED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), DATAADDED_ISSUE));
            }
            if ((filter & INCLUDE_DATAREMOVED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), DATAREMOVED_ISSUE));
            }
            if ((filter & INCLUDE_DATACHANGED_ISSUES) == 0x0) {
                p = cb.and(p, cb.notEqual(i.get(ISSUE_STATUS).get(CID), DATACHANGED_ISSUE));
            }
        }

        cq.select(cb.count(dc));
        cq.where(p);
        TypedQuery<Long> countQuery = em.createQuery(cq);
        try {
            count = countQuery.getSingleResult();
        } catch (Exception e) {
        }
        em.close();
        return count;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public AnIssuePack extjsFindAll(
            @QueryParam("cid") Integer cid,
            @QueryParam("lid") Integer lid,
            @QueryParam("gid") Integer gid,
            @QueryParam("sid") Integer sid,
            @QueryParam("pid") Integer pid,
            @QueryParam("qid") Integer qid,
            @QueryParam("sort") String sort,
            @QueryParam("start") Integer start,
            @QueryParam("limit") Integer limit,
            @QueryParam("filter") Integer filter,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnIssuePack p = new AnIssuePack();
        if (isValidSession(sessionId, userId)) {
            p.setDataSet(null, 0L);
            List<AnIssue> issues;

            if (cid == null || cid == -1) {
                issues = super.findAll();
            } else {
                // by default, sort in reverse chronological order
                String orderBy = "lastUpdate";
                String orderDir = "DESC";

                // check sorting request from client
                if (sort != null) {
                    JSONArray array;
                    try {
                        array = new JSONArray(sort);
                        JSONObject obj = array.getJSONObject(0);
                        orderBy = (String) obj.get("property");
                        orderDir = (String) obj.get("direction");
                    } catch (JSONException ex) {
                    }
                }

                issues = getIssues(cid, lid, gid, sid, pid, qid,
                        orderBy, orderDir, start, limit, filter);
            }

            if (issues == null || issues.isEmpty()) {
                p.setDataSet(null, 0L);
            } else {
                ArrayList<AnIssueResponse> t = new ArrayList<>();
                Iterator<AnIssue> i = issues.iterator();
                while (i.hasNext()) {
                    t.add(prepareIssueResponse(i.next()));
                }
                p.setDataSet(t);
                p.setTotal(countTotalIssues(cid, lid, gid, sid, pid, qid, filter));
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public AnIssuePack findByContext(
            @PathParam("id") Long contextId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnIssuePack p = new AnIssuePack();
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            TypedQuery<AnIssue> q = em.createNamedQuery(
                    "AnIssue.findByContextId", AnIssue.class);
            q.setParameter("contextId", contextId);
            List<AnIssue> issues = q.getResultList();
            if (issues == null || issues.isEmpty()) {
                p.setDataSet(null, 0L);
            } else {
                Iterator<AnIssue> i = issues.iterator();
                ArrayList<AnIssueResponse> t = new ArrayList<>();
                while (i.hasNext()) {
                    t.add(prepareIssueResponse(i.next()));
                }
                p.setDataSet(t);
            }
            em.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
