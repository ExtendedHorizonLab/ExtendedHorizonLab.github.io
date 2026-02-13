---
title: "Less Can Be More: Exploring Population Rating Dispositions with Partitioned Models in Recommender Systems"
date: 2023-06-18
venue: "UMAP '23: Adjunct Proceedings of the 31st ACM Conference on User Modeling, Adaptation and Personalization"
authors: ["Ruixuan Sun", "Ruoyan Kong", "Qiao Jin", "Joseph A. Konstan"]
pub_type: "conference"
pdf: "/papers/less-can-be-more-umap2023.pdf"
doi: "https://doi.org/10.1145/3563359.3597390"
thumbnail: "/images/publications/less-can-be-more-umap2023.png"
figure: "/images/publications/figures/less-can-be-more-umap2023.png"
abstract: "In this study, we partition users by rating disposition - looking first at their percentage of negative ratings, and then at the general use of the rating scale. We hypothesize that users with different rating dispositions may use the recommender system differently and therefore the agreement with their past ratings may be less predictive of the future agreement. We use data from a large movie rating website to explore whether users should be grouped by disposition, focusing on identifying their various rating distributions that may hurt recommender effectiveness. We find that such partitioning not only improves computational efficiency but also improves top-k performance and predictive accuracy."
summary: "This paper shows that movie recommendation systems can work better by first grouping users based on how they tend to rate -- for example, whether they skew positive or negative. By training separate models for each group rather than one model for everyone, the system becomes both faster and more accurate at predicting what users will enjoy."
---
