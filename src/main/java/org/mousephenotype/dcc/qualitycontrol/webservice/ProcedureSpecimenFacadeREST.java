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
            @QueryParam("q") String specimenQuery,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
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

            // we shall use criteria queries instead of named query because
            // there are several client requested specification that could
            // affect the query.
            EntityManager em = getEntityManager();
            CriteriaBuilder cb = em.getCriteriaBuilder();

            // we are going to extract procedure-specimen information that
            // matches the data context defined by the centre, genotype,
            // background strain and procedure.
            CriteriaQuery<ProcedureSpecimen> cq = cb.createQuery(ProcedureSpecimen.class);

            // this creates a base query that will bring all of the records
            // in the procedure_animal_overview table. This is quivalent to
            // JPQL "... FROM ProcedureAnimalOverview pao ..."
            Root<ProcedureAnimalOverview> pao = cq.from(ProcedureAnimalOverview.class);
            // this extends the base query above to also include data from the
            // animal_overview table. This is equivalent to the JPQL
            // "... FROM ProcedureAnimalOverview pao, AnimalOverview ao ..."
            //
            // Note that this extends the existing root 'pao'. Ideally, we
            // should have chosen a join; however, the current database
            // schema does not link the two tables procedure_animal_overview
            // and animal_overview using a foreign key.
            Root<AnimalOverview> ao = cq.from(AnimalOverview.class);

            // what is the matching criteria?
            Pipeline pipeline = em.find(Pipeline.class, lid);
            Predicate p = cb.and(cb.equal(pao.get("centreId"), cid),
                    cb.equal(pao.get("pipeline"), pipeline.getPipelineKey()),
                    cb.equal(pao.get("genotypeId"), gid),
                    cb.equal(pao.get("strainId"), sid),
                    cb.equal(pao.get("procedureId"), peid));

            // next, we should select only the records that are visible
            // in the specified window (which is when paging is used).
            // Note here that since we are not using a join, we have to
            // add an additional criteria to match the two tables.
            p = cb.and(cb.equal(pao.get("animalId"), ao.get("animalId")), p);

            // Search for specimen
            if (specimenQuery != null) {
                p = cb.and(cb.like(pao.<String>get("animalName"),
                        "%" + specimenQuery + "%"), p);
            }
            cq.where(p);

            // first we need the count of the number of records that match
            // the data context criteria. This is the totaal number of
            // records available, not just the selection that we will return.
            CriteriaQuery<Long> cq1 = cb.createQuery(Long.class);
            cq1.where(p);
            cq1.select(cb.count(pao));
            TypedQuery<Long> count = em.createQuery(cq1);
            Long total = count.getSingleResult().longValue();

            // how should we order the records?
            // Note that we have to ensure that we are choosing the correct
            // table and column to do the sorting.
            OrderbyAndEntity soe = decode(orderBy);

            // which direction to sort?
            if ("ASC".equals(direction)) {
                if (soe.usePao) {
                    cq.orderBy(cb.asc(pao.get(soe.orderBy)));
                } else {
                    cq.orderBy(cb.asc(ao.get(soe.orderBy)));
                }
            } else {
                if (soe.usePao) {
                    cq.orderBy(cb.desc(pao.get(soe.orderBy)));
                } else {
                    cq.orderBy(cb.desc(ao.get(soe.orderBy)));
                }
            }
            // we do not require all of the fields from both tables. We only
            // require a selection of fields from both tables. Make a selection
            // as required by the procedure-specimen entity. This is the record
            // that will be returned as a JSON response.
            CompoundSelection<ProcedureSpecimen> ps
                    = cb.construct(ProcedureSpecimen.class,
                            ao.get("animalId"), pao.get("procedureOccurrenceId"),
                            ao.get("animalName"), ao.get("cohortName"), pao.get("sex"),
                            pao.get("zygosity"), ao.get("dob"), ao.get("litter"),
                            pao.get("pipeline"), pao.get("experimenter"),
                            pao.get("startDate"), pao.get("equipmentname"),
                            pao.get("equipmentmodel"),
                            pao.get("equipmentmanufacturer"));

            cq.select(ps);
            TypedQuery<ProcedureSpecimen> query = em.createQuery(cq);
            // we do not want all of the available records. We only require
            // a selection of the records that are visible inside the page.
            if (start
                    != null) {
                query.setFirstResult(start);
            }
            if (limit
                    != null) {
                query.setMaxResults(limit);
            }

            // all done, return the JSON response
            t.setDataSet(query.getResultList(), total);
            em.close();
        }
        return t;
    }
}
