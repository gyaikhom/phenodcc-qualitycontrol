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

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.persistence.criteria.*;
import javax.ws.rs.*;
import javax.ws.rs.Path;
import javax.ws.rs.core.MediaType;
import org.codehaus.jettison.json.JSONArray;
import org.codehaus.jettison.json.JSONException;
import org.codehaus.jettison.json.JSONObject;
import org.mousephenotype.dcc.qualitycontrol.entities.ProcedureSpecimen;
import org.mousephenotype.dcc.entities.impress.Pipeline;
import org.mousephenotype.dcc.entities.overviews.AnimalOverview;
import org.mousephenotype.dcc.entities.overviews.ProcedureAnimalOverview;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.ProcedureSpecimenPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("procedurespecimens")
public class ProcedureSpecimenFacadeREST extends AbstractFacade<ProcedureSpecimen> {

    public ProcedureSpecimenFacadeREST() {
        super(ProcedureSpecimen.class);
    }

    private class OrderbyAndEntity {

        boolean usePao;
        String orderBy;
    };

    private OrderbyAndEntity decodeAnimalOverview(String o) {
        OrderbyAndEntity r = new OrderbyAndEntity();
        r.usePao = false;
        if ("n".equals(o)) {
            r.orderBy = "animalName";
        } else {
            if ("c".equals(o)) {
                r.orderBy = "cohortName";
            } else {
                if ("d".equals(o)) {
                    r.orderBy = "dob";
                } else {
                    if ("l".equals(o)) {
                        r.orderBy = "litter";
                    } else {
                        r.orderBy = o;
                        r.usePao = true;
                    }
                }
            }
        }
        return r;
    }

    private OrderbyAndEntity decode(String o) {
        OrderbyAndEntity r = new OrderbyAndEntity();
        r.usePao = true;
        if ("ai".equals(o)) {
            r.orderBy = "animalId";
        } else {
            if ("s".equals(o)) {
                r.orderBy = "sex";
            } else {
                if ("sd".equals(o)) {
                    r.orderBy = "startDate";
                } else {
                    if ("e".equals(o)) {
                        r.orderBy = "experimenter";
                    } else {
                        if ("z".equals(o)) {
                            r.orderBy = "zygosity";
                        } else {
                            if ("en".equals(o)) {
                                r.orderBy = "equipmentname";
                            } else {
                                if ("em".equals(o)) {
                                    r.orderBy = "equipmentmodel";
                                } else {
                                    if ("et".equals(o)) {
                                        r.orderBy = "equipmentmanufacturer";
                                    } else {
                                        r = decodeAnimalOverview(o);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return r;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public ProcedureSpecimenPack extjsFindBy(
            @QueryParam("cid") Integer cid,
            @QueryParam("lid") Integer lid,
            @QueryParam("gid") Integer gid,
            @QueryParam("sid") Integer sid,
            @QueryParam("peid") String peid,
            @QueryParam("sort") String sort,
            @QueryParam("start") Integer start,
            @QueryParam("limit") Integer limit,
            @QueryParam("n") String specimenNameQuery,
            @QueryParam("a") BigInteger specimenIdQuery,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId,
            @QueryParam("unique") Boolean uniqueSpecimens) {
        ProcedureSpecimenPack t = new ProcedureSpecimenPack();
        if (!isValidSession(sessionId, userId)) {
            t.setSuccess(false);
            return t;
        }

        if (cid == null || lid == null || gid == null || sid == null || peid == null) {
            t.setDataSet(null, 0L);
        } else {
            // by default, sort in reverse chronological order
            String orderBy = "startDate";
            String direction = "DESC";
            if (uniqueSpecimens == null) {
                uniqueSpecimens = false;
            }

            // check sorting request from client
            if (sort != null) {
                JSONArray array;
                try {
                    array = new JSONArray(sort);
                    JSONObject obj = array.getJSONObject(0);
                    orderBy = (String) obj.get("property");
                    direction = (String) obj.get("direction");
                } catch (JSONException ex) {
                }
            }

            EntityManager em = getEntityManager();
            StringBuilder condition = new StringBuilder("from ProcedureAnimalOverview pao, AnimalOverview ao, Pipeline l WHERE pao.animalId = ao.animalId AND pao.pipeline = l.pipelineKey AND pao.centreId = :cid AND l.pipelineId = :lid AND pao.genotypeId = :gid AND pao.strainId = :sid AND pao.procedureId = :peid");

            if (specimenIdQuery != null) {
                condition.append(" AND pao.animalId = :aid");
            } else {
                if (specimenNameQuery != null) {
                    specimenNameQuery = '%' + specimenNameQuery + '%';
                    condition.append(" AND pao.animalName like :aname");
                }
            }

            TypedQuery<Long> qCount = em.createQuery(
                    "SELECT count(" + (uniqueSpecimens ? "distinct" : "")
                    + " pao.animalId) " + condition.toString(), Long.class);
            if (specimenIdQuery != null) {
                qCount.setParameter("aid", specimenIdQuery);
            } else {
                if (specimenNameQuery != null) {
                    qCount.setParameter("aname", specimenNameQuery);
                }
            }
            qCount.setParameter("cid", cid);
            qCount.setParameter("lid", lid);
            qCount.setParameter("gid", gid);
            qCount.setParameter("sid", sid);
            qCount.setParameter("peid", peid);
            qCount.setMaxResults(1);
            Long total = qCount.getSingleResult();

            String selectQuery;
            if (uniqueSpecimens) {
                selectQuery = "SELECT new org.mousephenotype.dcc.qualitycontrol.entities.ProcedureSpecimen(ao.animalId, pao.procedureOccurrenceId, ao.animalName, ao.cohortName, pao.sex, pao.zygosity, ao.dob, ao.litter, pao.pipeline, pao.experimenter, MIN(pao.startDate), pao.equipmentname, pao.equipmentmodel, pao.equipmentmanufacturer)";
                condition.append(" GROUP BY pao.animalId");
            } else {
                selectQuery = "SELECT new org.mousephenotype.dcc.qualitycontrol.entities.ProcedureSpecimen(ao.animalId, pao.procedureOccurrenceId, ao.animalName, ao.cohortName, pao.sex, pao.zygosity, ao.dob, ao.litter, pao.pipeline, pao.experimenter, pao.startDate, pao.equipmentname, pao.equipmentmodel, pao.equipmentmanufacturer)";
            }

            // how should we order the records?
            // Note that we have to ensure that we are choosing the correct
            // table and column to do the sorting.
            OrderbyAndEntity soe = decode(orderBy);
            condition.append(" ORDER BY ");
            condition.append(soe.usePao ? "pao." : "ao.");
            condition.append(soe.orderBy);
            condition.append(" ");
            condition.append(direction);

            TypedQuery<ProcedureSpecimen> q = em.createQuery(selectQuery + condition.toString(), ProcedureSpecimen.class);
            if (specimenIdQuery != null) {
                q.setParameter("aid", specimenIdQuery);
            } else {
                if (specimenNameQuery != null) {
                    q.setParameter("aname", specimenNameQuery);
                }
            }
            q.setParameter("cid", cid);
            q.setParameter("lid", lid);
            q.setParameter("gid", gid);
            q.setParameter("sid", sid);
            q.setParameter("peid", peid);
            q.setFirstResult(start);
            q.setMaxResults(limit);
            List<ProcedureSpecimen> result = q.getResultList();

            // all done, return the JSON response
            t.setDataSet(result, total);
            em.close();
        }
        return t;
    }
}
